import { expect, test } from '@playwright/test';

test('time range reloads the policy chart and evidence from the same analysis', async ({
  page,
}) => {
  let sampleCount = 30;
  await page.route('**/api/v1/policies/history-test?*', async (route) => {
    const minutes = Number(
      new URL(route.request().url()).searchParams.get('minutes'),
    );
    const policy = {
      _id: 'history-test',
      name: 'Delivery monitor',
      namespace: 'local',
      sourceService: 'A',
      destinationService: 'B',
      destination: 'events',
      subscription: 'sub',
      thresholdSeconds: 1,
      requiredSuccessPercentage: 95,
      evaluationWindowMinutes: 30,
      minimumSampleCount: 1,
      enabled: true,
      effectiveFrom: '2026-10-24T12:00:00Z',
    };
    const analysis = {
      policyId: policy._id,
      thresholdSeconds: 1,
      requiredSuccessPercentage: 95,
      evaluatedAt: '2026-10-24T12:00:00Z',
      from: new Date(
        Date.parse('2026-10-24T12:00:00Z') - minutes * 60_000,
      ).toISOString(),
      to: '2026-10-24T12:00:00Z',
      status: 'pass',
      counts: {
        total: sampleCount,
        eligible: sampleCount,
        pending: 0,
        passed: sampleCount,
        late: 0,
        missing: 0,
      },
      successPercentage: 100,
      p95Seconds: 0.5,
      messages: Array.from({ length: sampleCount }, (_, index) => ({
        messageId:
          index === 0 ? `range-${minutes}` : `range-${minutes}-${index}`,
        detailId: index === 0 ? 'message' : `message-${index}`,
        sentAt: new Date(
          minutes >= 1440 && index > 0
            ? Date.parse('2026-10-24T12:00:00Z') -
                minutes * 60_000 * (index / 31)
            : sampleCount > 120
              ? Date.parse('2026-10-24T12:00:00Z') - (index + 1) * 1000
              : Date.parse('2026-10-24T11:59:00Z') + index * 200,
        ).toISOString(),
        receivedAt: '2026-10-24T11:59:00.500Z',
        latencySeconds:
          sampleCount > 120 && Math.floor(index / 30) % 2 === 1 ? 1.5 : 0.5,
        outcome:
          sampleCount > 120 && Math.floor(index / 30) % 2 === 1
            ? 'late'
            : 'passed',
      })),
    };
    await route.fulfill({
      json: {
        success: true,
        data: { policy, latestEvaluation: analysis, evaluations: [], analysis },
      },
    });
  });
  await page.goto('/policies/history-test');
  await expect(
    page.getByRole('link', { name: 'range-30', exact: true }),
  ).toBeVisible();
  const chart = page.getByRole('region', {
    name: 'Message delivery latency line chart compared with policy threshold',
  });
  const chartCard = page.getByRole('region', {
    name: 'Delivery latency',
    exact: true,
  });
  await expect(chartCard).toContainText('Received messages');
  await expect(chartCard).toContainText('Policy threshold');
  await test.info().attach('policy-latency-chart', {
    body: await chartCard.screenshot(),
    contentType: 'image/png',
  });
  await expect(chart.locator('circle')).toHaveCount(0);
  const perMessageCurve = await chart
    .locator('.recharts-line-curve')
    .getAttribute('d');
  expect((perMessageCurve?.match(/[LC]/g) ?? []).length).toBe(29);
  await page.getByRole('button', { name: 'Time', exact: true }).click();
  await expect(chart.locator('.recharts-line-curve')).toBeAttached();
  const curve = await chart.locator('.recharts-line-curve').getAttribute('d');
  expect((curve?.match(/[LC]/g) ?? []).length).toBe(29);
  await expect(chart.locator('circle')).toHaveCount(0);
  await page.getByRole('button', { name: 'Per message', exact: true }).click();
  await page.getByLabel('Time range', { exact: true }).selectOption('10080');
  await expect(
    page.getByRole('link', { name: 'range-10080', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'range-30', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Selected range' }),
  ).toContainText('Last 1 week');
  await expect(
    page.getByRole('region', {
      name: 'Message delivery latency line chart compared with policy threshold',
    }),
  ).toBeVisible();
  for (const minutes of ['1440', '10080', '43200']) {
    await page.getByLabel('Time range', { exact: true }).selectOption(minutes);
    await expect(
      page.getByRole('link', { name: `range-${minutes}`, exact: true }),
    ).toBeVisible();
    await expect(chartCard).toContainText('p95 delivery latency per');
    expect(
      await chart.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await expect(chart.getByRole('link')).toHaveCount(0);
    const bucketCurve = await chart
      .locator('.recharts-line-curve')
      .getAttribute('d');
    expect((bucketCurve?.match(/M/g) ?? []).length).toBe(1);
    expect((bucketCurve?.match(/[LC]/g) ?? []).length).toBeGreaterThan(1);
    const chartScroller = chart.locator('..');
    const widthBefore = await chartScroller.evaluate(
      (element) => element.scrollWidth,
    );
    await chart.scrollIntoViewIfNeeded();
    for (const fraction of [0, 1]) {
      const position = await chart
        .locator('.recharts-line-curve')
        .evaluate((element, fraction) => {
          const path = element as SVGPathElement;
          const point = path.getPointAtLength(path.getTotalLength() * fraction);
          const screen = new DOMPoint(point.x, point.y).matrixTransform(
            path.getScreenCTM()!,
          );
          return { x: screen.x, y: screen.y };
        }, fraction);
      await page.mouse.move(position.x, position.y);
      await expect(chart.locator('.recharts-tooltip-wrapper')).toBeVisible();
      await expect(chart.locator('circle')).toHaveCount(0);
      expect(
        await chartScroller.evaluate((element) => element.scrollWidth),
      ).toBe(widthBefore);
    }
  }
  sampleCount = 600;
  for (const minutes of ['15', '30']) {
    await page.getByLabel('Time range', { exact: true }).selectOption(minutes);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(chartCard.locator('dd').first()).toContainText('600');
    await expect(chartCard).toContainText('seconds');
    await expect(chart.locator('.recharts-line-curve')).toHaveAttribute(
      'stroke',
      /^url\(#latency-/,
    );
    await expect(chart.locator('linearGradient stop').first()).toHaveAttribute(
      'offset',
      '0.5',
    );
    await expect(chart.locator('circle')).toHaveCount(0);
    expect(
      await chart.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await chartCard.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await chartCard.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'range-30', exact: true }).click();
  await expect(page).toHaveURL(/\/messages\/message$/);
});
