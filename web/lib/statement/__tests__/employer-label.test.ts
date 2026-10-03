import { employerLabelNote, looksTruncatedEmployerName } from '../employerLabel';

describe('employerLabel', () => {
  it('flags a name cut off mid-word and labels it', () => {
    expect(looksTruncatedEmployerName('NIGERIAN U')).toBe(true);
    expect(employerLabelNote('NIGERIAN U')).toContain('Employer (via Remita)');
  });
  it('leaves full names and allowance groups alone', () => {
    expect(looksTruncatedEmployerName('Nigerian Upstream Petroleum Regulatory Commission')).toBe(false);
    expect(employerLabelNote('Allowances U')).toBeNull();
    expect(employerLabelNote('')).toBeNull();
  });
});
