# Analisis Risiko Keamanan Informasi

Dokumen ini menjelaskan risiko utama untuk Modul 1 Autentikasi dan Keamanan SmartStock Pro. Sistem dipakai PT Maju Bersama Digital untuk mengelola akses user, session, permission, dan audit log.

Implementasi terkait:

- @src/api/v1/auth.ts
- @src/api/v1/users.ts
- @src/api/v1/audit-logs.ts
- @src/client/auth/index.ts
- @src/client/users/index.ts
- @src/client/audit-logs/index.ts
- @src/drizzle-schema/index.ts
- @src/lib/password.ts
- @src/lib/session.ts
- @src/zod-schemas/index.ts

## Status implementasi

- Login multi-role sudah memakai session cookie aman.
- Password disimpan memakai hash Argon2.
- Password baru divalidasi dengan aturan minimal 8 karakter, huruf besar, huruf kecil, angka, dan simbol.
- API protected memvalidasi session dan permission.
- Request mutasi setelah login wajib membawa CSRF token.
- Audit log mencatat aktivitas login, logout, akses ditolak, dan perubahan user.
- Response error tidak mengirim password, token, secret, atau stack trace.

## Risiko 1: SQL Injection

- Risiko: input user disisipkan ke query database.
- Dampak: data user, session, atau audit log dapat dibaca atau diubah tanpa izin.
- Mitigasi: semua query memakai Drizzle ORM dan filter yang dipilih dari kolom yang sudah ditentukan.
- Implementasi di SmartStock Pro: query user, session, dan audit log berada di @src/client/auth/index.ts, @src/client/users/index.ts, dan @src/client/audit-logs/index.ts.
- Modul terdampak: Auth, Users, Audit Logs.
- Status: diterapkan.

## Risiko 2: XSS

- Risiko: input seperti nama user atau deskripsi audit ditampilkan sebagai HTML.
- Dampak: attacker dapat menjalankan script di browser user.
- Mitigasi: UI menampilkan data sebagai text React biasa dan tidak memakai HTML mentah.
- Implementasi di SmartStock Pro: halaman login, user management, dashboard, dan audit log memakai komponen React biasa di @src/app.
- Modul terdampak: Login, Dashboard, Users, Audit Logs.
- Status: diterapkan.

## Risiko 3: CSRF

- Risiko: browser user mengirim request mutasi tanpa niat user karena cookie session ikut terkirim.
- Dampak: attacker dapat membuat atau mengubah user jika user admin sedang login.
- Mitigasi: session cookie memakai SameSite lax, dan request mutasi wajib membawa CSRF token.
- Implementasi di SmartStock Pro: token dibuat saat login di @src/client/auth/index.ts, disimpan sebagai hash pada session, lalu dicek oleh API melalui @src/lib/session.ts.
- Modul terdampak: Auth, Users, Audit Logs.
- Status: diterapkan.

## Risiko 4: Weak password

- Risiko: password mudah ditebak atau cepat di-crack.
- Dampak: akun dapat diambil alih.
- Mitigasi: password wajib minimal 8 karakter, memiliki huruf besar, huruf kecil, angka, dan simbol.
- Implementasi di SmartStock Pro: validasi ada di @src/utils/passwordPolicy.ts dan hashing Argon2 ada di @src/lib/password.ts.
- Modul terdampak: Login, Create User, Reset Password, Seed Demo.
- Status: diterapkan.

## Risiko 5: Brute force login

- Risiko: attacker mencoba banyak kombinasi email dan password.
- Dampak: akun dengan password lemah dapat ditebak.
- Mitigasi: login gagal dicatat ke audit log agar percobaan mencurigakan dapat ditinjau.
- Implementasi di SmartStock Pro: aksi `AUTH_LOGIN_FAILED` dicatat di @src/client/auth/index.ts.
- Modul terdampak: Auth, Audit Logs.
- Status: sebagian diterapkan. Rate limit belum dibuat karena Modul 1 belum menambahkan Redis limiter.

## Risiko 6: Session hijacking

- Risiko: session token dicuri dari browser atau jaringan.
- Dampak: attacker dapat memakai akun user sampai session habis.
- Mitigasi: session cookie httpOnly, secure pada production, SameSite lax, token disimpan sebagai hash, idle timeout 30 menit, absolute timeout 24 jam.
- Implementasi di SmartStock Pro: cookie dan token helper ada di @src/lib/session.ts, validasi session ada di @src/client/auth/index.ts.
- Modul terdampak: Auth, Dashboard, API Protected.
- Status: diterapkan.

## Risiko 7: Unauthorized access

- Risiko: user non-admin memanggil endpoint admin secara langsung.
- Dampak: user dapat mengubah role, reset password, atau melihat audit log tanpa izin.
- Mitigasi: backend memvalidasi permission pada API, bukan hanya menyembunyikan menu.
- Implementasi di SmartStock Pro: permission dicek di @src/api/middlewares/session.ts dan rules role ada di @src/constants/auth.ts.
- Modul terdampak: Users, Audit Logs, Dashboard Navigation.
- Status: diterapkan.

## Risiko 8: File upload abuse

- Risiko: file berbahaya diunggah untuk menyerang server atau user lain.
- Dampak: penyimpanan penuh, file berbahaya tersebar, atau proses import gagal.
- Mitigasi: Modul 1 belum membuat upload, tetapi aturan keamanan upload harus memakai validasi tipe, ukuran, dan isi file.
- Implementasi di SmartStock Pro: aturan upload saat ini ada di @src/constants/upload.ts dan helper gambar ada di @src/utils/imageUpload.ts.
- Modul terdampak: Import, Product Image, Future Upload.
- Status: belum masuk scope Modul 1.

## Risiko 9: Audit log tampering

- Risiko: user menghapus atau mengubah audit log untuk menutupi aktivitas.
- Dampak: perubahan penting tidak dapat ditelusuri.
- Mitigasi: tidak ada endpoint delete audit log, dan audit log hanya bisa dibaca admin.
- Implementasi di SmartStock Pro: audit log ditulis lewat @src/client/audit-logs/index.ts dan dibaca lewat @src/api/v1/audit-logs.ts.
- Modul terdampak: Audit Logs, Users, Auth.
- Status: diterapkan untuk MVP. Proteksi append-only database dapat ditambah setelah MVP.

## Risiko 10: Data exposure through error response

- Risiko: API mengirim stack trace, token, secret, atau password hash ke client.
- Dampak: attacker mendapat informasi internal untuk serangan lanjutan.
- Mitigasi: error API memakai response aman dan user response tidak menyertakan password hash.
- Implementasi di SmartStock Pro: error response ada di @src/api/response.ts, user serializer ada di @src/client/types.ts.
- Modul terdampak: Semua API Modul 1.
- Status: diterapkan.

## Catatan demo

- Seed demo membuat 4 user lokal untuk role Admin, Warehouse Manager, Warehouse Staff, dan Viewer.
- Password demo hanya untuk local development.
- Jalankan seed setelah migration selesai.
