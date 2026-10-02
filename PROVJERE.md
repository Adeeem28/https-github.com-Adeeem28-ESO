# ESO 6.2.4 — završno stanje, 02.10.2026.

Ovo je pripremljeni izvorni paket. Nije objavljen na Vercelu. Produkcijska Supabase baza `uwrhwskwnyguktddfhmy` ima primijenjene migracije V6.2.1, V6.2.2, V6.2.3, V6.2.4 HUNT i korektivnu HUNT trigger/index migraciju.

| Provjera | Rezultat |
|---|---|
| TypeScript | Prošao |
| Produkcijski Next.js build | Prošao |
| Testovi pravila, datuma, importa/izvoza i postojećih tokova | 34/34 |
| Testovi PostgreSQL migracija na stvarnoj strukturi i sintetičkim podacima | 31/31 |
| API/sesije, uključujući 34 zaštićene API metode | 20/20 |
| npm audit, sve instalirane zavisnosti | 0 poznatih ranjivosti na dan provjere |
| Pokrenuti build: CSP nonce, privatno keširanje, neovlašten pristup, cron, porijeklo zahtjeva | Prošao |
| Automatizirani prikaz desktop/mobilnog UI-ja | Nije dovršen: preglednik se ruši pri inicijalizaciji grafike u testnom okruženju |
| Produkcijski HUNT schema/trigger smoke test | Prošao u rollback transakciji; trajnih sintetičkih redova nema |
| Stvarna produkcijska prijava, upload u Storage, HUNT start i push dostava | Potrebna provjera nakon objave |

ZIP je lokalno raspakovan i provjeren; sadrži izvorne fajlove, migracije i upute. Browser test je pripremljen u `tests/ui-smoke.cjs`. Ispravno prihvata lokalni Chromium, `BROWSER_CHANNEL` ili `BROWSER_EXECUTABLE_PATH`. Ne tvrdi se da je test prikaza prošao u ovoj završnoj verziji.

## Produkcijska baza

Read-only provjera nakon migracije potvrđuje da je `eso_set_completion_resolver_v622` prisutan kao `SECURITY INVOKER`, da ga može izvršiti samo `service_role`, a `anon` i `authenticated` nemaju izvršenje. Security advisor i dalje prikazuje samo očekivani INFO nalaz za RLS tabele bez javnih politika; browser uloge nemaju privilegije, a aplikacija koristi server-side `service_role` pristup.

Migracije su provjerene lokalno i na produkciji. Čuvaju prijave i korisnike, zatvaraju javne privilegije, omogućuju novu obradu, ispravljaju grupu pet ranije prepoznatih After fotografija, dodaju auditovan retroaktivni resolver assignment i additive-only HUNT povezivanje. Ne uklanjaju fizičke fotografije niti kopiraju ESO prijave. Preflight nije našao konflikte firma/pogon/lokacija ili duple nazive za nova ograničenja.

HUNT trigger je testiran u rollback transakciji: prijava člana unutar aktivnog prozora dobija jednu Hunt vezu, a prijava izvan prozora ne dobija nijednu. Super Admin review ostaje ručan jer softver ne može pouzdano zaključiti da su dvije različito opisane prijave isti fizički problem.

Nakon korektivne migracije performance advisor više ne prijavljuje neindeksirane Hunt foreign-key veze. Security advisor zadržava samo postojeći INFO obrazac za RLS tabele bez javnih politika, što je namjerno u ovoj server-session arhitekturi.

Prijava Employee korisnika ostaje preko ID-a, kao u postojećem poslovnom modelu. Ona ne potvrđuje identitet lozinkom. Lozinke drugih uloga ostaju obavezne, a pokušaji prijave su ograničeni u bazi.

Upute za objavu i varijable su u `README.md` i `.env.example`. Tajne vrijednosti, node_modules i build izlaz nisu uključeni u paket.
