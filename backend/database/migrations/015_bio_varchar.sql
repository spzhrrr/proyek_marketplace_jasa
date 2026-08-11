-- Bio publik singkat di header profil (bukan esai).
UPDATE users SET bio = LEFT(bio, 180) WHERE CHAR_LENGTH(bio) > 180;
ALTER TABLE users MODIFY bio VARCHAR(180) NULL;
