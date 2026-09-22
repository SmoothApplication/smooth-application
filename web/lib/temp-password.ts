// Generates a random, easy-to-read-aloud-or-text temporary password for admin invites (see
// supabase/migrations/0003_temp_password_invites.sql for why we moved off magic links). Avoids
// visually ambiguous characters (0/O, 1/l/I) since these often get copied by hand into a phone.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateTempPassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
