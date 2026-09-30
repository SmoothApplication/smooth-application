import {
  initialLockStatus,
  isValidPinShape,
  pinsMatch,
  isValidRecoveryPhraseShape,
  pinShapeError,
} from '../appLockState';

describe('initialLockStatus', () => {
  it('is "locked" when a lock record already exists on disk', () => {
    expect(initialLockStatus(true)).toBe('locked');
  });

  it('is "no-pin" when no lock record exists yet (every applicant before this feature, or one who never set it up)', () => {
    expect(initialLockStatus(false)).toBe('no-pin');
  });
});

describe('isValidPinShape', () => {
  it('accepts 4-8 digit numeric PINs', () => {
    expect(isValidPinShape('1234')).toBe(true);
    expect(isValidPinShape('12345678')).toBe(true);
  });

  it('rejects PINs shorter than 4 or longer than 8 digits', () => {
    expect(isValidPinShape('123')).toBe(false);
    expect(isValidPinShape('123456789')).toBe(false);
  });

  it('rejects non-numeric characters', () => {
    expect(isValidPinShape('12a4')).toBe(false);
    expect(isValidPinShape('')).toBe(false);
  });
});

describe('pinsMatch', () => {
  it('is true only when both are non-empty and identical', () => {
    expect(pinsMatch('1234', '1234')).toBe(true);
    expect(pinsMatch('1234', '4321')).toBe(false);
    expect(pinsMatch('', '')).toBe(false);
  });
});

describe('isValidRecoveryPhraseShape', () => {
  it('accepts the 4x4 hyphenated shape', () => {
    expect(isValidRecoveryPhraseShape('ABCD-EFGH-JKMN-PQRS')).toBe(true);
  });

  it('tolerates stray whitespace and lowercase, like a handwritten code copied by hand', () => {
    expect(isValidRecoveryPhraseShape('  abcd-efgh-jkmn-pqrs  ')).toBe(true);
    expect(isValidRecoveryPhraseShape('abcd - efgh - jkmn - pqrs')).toBe(true);
  });

  it('rejects the visually-ambiguous characters the alphabet deliberately excludes (0/O, 1/I/L)', () => {
    expect(isValidRecoveryPhraseShape('ABCD-EFGH-JKMN-PQR0')).toBe(false);
    expect(isValidRecoveryPhraseShape('ABCD-EFGH-JKMN-PQR1')).toBe(false);
  });

  it('rejects an incomplete or malformed phrase', () => {
    expect(isValidRecoveryPhraseShape('ABCD-EFGH-JKMN')).toBe(false);
    expect(isValidRecoveryPhraseShape('not a recovery phrase')).toBe(false);
    expect(isValidRecoveryPhraseShape('')).toBe(false);
  });
});

describe('pinShapeError', () => {
  it('is null while empty or still mid-typing a valid-so-far PIN', () => {
    expect(pinShapeError('')).toBeNull();
    expect(pinShapeError('12')).toBeNull();
    expect(pinShapeError('1234')).toBeNull();
  });

  it('flags non-numeric characters immediately', () => {
    expect(pinShapeError('12a4')).toBe('PIN can only contain numbers.');
  });

  it('flags more than 8 digits', () => {
    expect(pinShapeError('123456789')).toBe('PIN must be 8 digits or fewer.');
  });
});
