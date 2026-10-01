# ESO 6.2.3 — završno stanje, 01.10.2026.

Ovo je pripremljeni izvorni paket. Nije objavljen na Vercelu. Produkcijska Supabase baza `uwrhwskwnyguktddfhmy` ima primijenjene migracije V6.2.1, V6.2.2 i V6.2.3.

| Provjera | Rezultat |
|---|---|
| TypeScript | Prošao |
| Produkcijski Next.js build | Prošao |
| Testovi pravila, datuma, importa/izvoza i postojećih tokova | 33/33 |
| Testovi PostgreSQL migracija na stvarnoj strukturi i sintetičkim podacima | 31/31 |
| API/sesije, uključujući 32 zaštićene API metode | 20/20 |
| npm audit, sve instalirane zavisnosti | 0 poznatih ranjivosti na dan provjere |
| Pokrenuti build: CSP nonce, privatno keširanje, neovlašten pristup, cron, porijeklo zahtjeva | Prošao |
| Automatizirani prikaz desktop/mobilnog UI-ja | Nije dovršen: preglednik se ruši pri inicijalizaciji grafike u testnom okruženju |
| Stvarna produkcijska prijava, upload u Storage i push dostava | Potrebna provjera nakon objave |

ZIP je lokalno raspakovan i provjeren; sadrži izvorne fajlove, migracije i upute. Browser test je pripremljen u `tests/ui-smoke.cjs`. Ispravno prihvata lokalni Chromium, `BROWSER_CHANNEL` ili `BROWSER_EXECUTABLE_PATH`. Ne tvrdi se da je test prikaza prošao u ovoj završnoj verziji.

## Produkcijska baza

Read-only provjera nakon migracije potvrđuje da je `eso_set_completion_resolver_v622` prisutan kao `SECURITY INVOKER`, da ga može izvršiti samo `service_role`, a `anon` i `authenticated` nemaju izvršenje. Security advisor i dalje prikazuje samo očekivani INFO nalaz za RLS tabele bez javnih politika; browser uloge nemaju privilegije, a aplikacija koristi server-side `service_role` pristup.

Migracije su provjerene lokalno i na produkciji. Čuvaju prijave i korisnike, zatvaraju javne privilegije, omogućuju novu obradu, ispravljaju grupu pet ranije prepoznatih After fotografija i dodaju auditovan retroaktivni resolver assignment. Ne uklanjaju fizičke fotografije. Preflight nije našao konflikte firma/pogon/lokacija ili duple nazive za nova ograničenja.

Prijava Employee korisnika ostaje preko ID-a, kao u postojećem poslovnom modelu. Ona ne potvrđuje identitet lozinkom. Lozinke drugih uloga ostaju obavezne, a pokušaji prijave su ograničeni u bazi.

Upute za objavu i varijable su u `README.md` i `.env.example`. Tajne vrijednosti, node_modules i build izlaz nisu uključeni u paket.
