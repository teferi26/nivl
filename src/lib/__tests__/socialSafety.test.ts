import { isReportReason, REPORT_REASONS } from '../socialSafety';

describe('social report boundaries', () => {
  it.each(REPORT_REASONS)('accepts the selectable $value reason', ({ value }) => {
    expect(isReportReason(value)).toBe(true);
  });
  it.each([null, undefined, '', 'spam', 'name;delete', {}, ['avatar']])('rejects unsupported report reason %p', (value) => {
    expect(isReportReason(value)).toBe(false);
  });
});
