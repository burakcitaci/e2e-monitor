import type { Policy } from '../../../lib/schemas';

export const emptyPolicyForm: {
  name: string;
  provider: 'azure' | 'aws';
  sourceService: string;
  destinationService: string;
  destination: string;
  subscription: string;
  thresholdSeconds: string;
  requiredSuccessPercentage: string;
  evaluationWindowMinutes: string;
  minimumSampleCount: string;
} = {
  name: '',
  provider: 'azure',
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
    namespace: '',
    thresholdSeconds: Number(form.thresholdSeconds),
    requiredSuccessPercentage: Number(form.requiredSuccessPercentage),
    evaluationWindowMinutes: Number(form.evaluationWindowMinutes),
    minimumSampleCount: Number(form.minimumSampleCount),
    enabled: true,
  };
}
