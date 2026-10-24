import type { Policy } from '../../../lib/schemas';

export const emptyPolicyForm = {
  name: '',
  namespace: 'local',
  sourceService: '',
  destinationService: '',
  destination: '',
  subscription: '',
  thresholdSeconds: '1',
  requiredSuccessPercentage: '95',
  evaluationWindowMinutes: '30',
  minimumSampleCount: '1',
};
export type PolicyForm = typeof emptyPolicyForm;

export function policyFromForm(
  form: PolicyForm,
): Omit<Policy, '_id' | 'effectiveFrom' | 'latestEvaluation'> {
  return {
    ...form,
    thresholdSeconds: Number(form.thresholdSeconds),
    requiredSuccessPercentage: Number(form.requiredSuccessPercentage),
    evaluationWindowMinutes: Number(form.evaluationWindowMinutes),
    minimumSampleCount: Number(form.minimumSampleCount),
    enabled: true,
  };
}
