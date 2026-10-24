import { readFileSync } from 'fs';
import {
  defaultServiceBusConfig,
  loadServiceBusConfig,
} from './service-bus-config';

jest.mock('fs', () => ({ readFileSync: jest.fn() }));
const read = jest.mocked(readFileSync);

describe('broker metadata for AI context', () => {
  beforeEach(() => jest.resetAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('reads configured topics after an unavailable candidate location', () => {
    const expected = defaultServiceBusConfig('configured-namespace');
    read
      .mockImplementationOnce(() => {
        throw new Error('Missing file');
      })
      .mockReturnValueOnce(JSON.stringify(expected));
    expect(loadServiceBusConfig('fallback')).toEqual(expected);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each(['missing', 'malformed', 'invalid shape'])(
    'preserves fallback metadata for %s configuration',
    (failure) => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      if (failure === 'missing')
        read.mockImplementation(() => {
          throw new Error('Missing file');
        });
      else read.mockReturnValue(failure === 'malformed' ? '{' : '{}');
      expect(loadServiceBusConfig('fallback')).toEqual(
        defaultServiceBusConfig('fallback'),
      );
    },
  );
});
