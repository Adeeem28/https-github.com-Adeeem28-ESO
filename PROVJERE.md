# ESO 6.2.2 — završno stanje, 01.10.2026.

Ovo je pripremljeni izvorni paket. Nije objavljen na Vercelu i SQL migracije nisu primijenjene na produkcijsku bazu.

| Provjera | Rezultat |
|---|---|
| TypeScript | Prošao |
| Produkcijski Next.js build | Prošao |
| Testovi pravila, datuma, importa/izvoza i postojećih tokova | 33/33 |
| Testovi PostgreSQL migracija na stvarnoj strukturi i sintetičkim podacima | 30/30 |
| API/sesije, uključujući 31 zaštićenu API metodu | 20/20 |
| npm audit, sve instalirane zavisnosti | 0 poznatih ranjivosti na dan provjere |
| Pokrenuti build: CSP nonce, privatno keširanje, neovlašten pristup, cron, porijeklo zahtjeva | Prošao |
| Automatizirani prikaz desktop/mobilnog UI-ja | Nije dovršen: preglednik se ruši pri inicijalizaciji grafike u testnom okruženju |
| Stvarna produkcijska prijava, upload u Storage i push dostava | Potrebna provjera nakon objave |

ZIP je lokalno raspakovan i provjeren; sadrži izvorne fajlove, migracije i upute. Browser test je pripremljen u `tests/ui-smoke.cjs`. Ispravno prihvata lokalni Chromium, `BROWSER_CHANNEL` ili `BROWSER_EXECUTABLE_PATH`. Ne tvrdi se da je test prikaza prošao u ovoj završnoj verziji.

## Produkcijska baza

Read-only provjera 01.10.2026. potvrđuje da nove sesije, audit i report RPC još ne postoje; RLS za plants i platform_owners još nije uključen. Zato se prije Vercel deploymenta moraju primijeniti obje navedene SQL migracije. Novi kod namjerno odbija nesiguran rezervni upis kada migracija nedostaje.

Migracije su provjerene lokalno. Čuvaju prijave i korisnike, zatvaraju javne privilegije, omogućuju novu obradu i ispravljaju grupu pet ranije prepoznatih After fotografija. Ne uklanjaju fizičke fotografije. Preflight iz prethodnog pregleda nije našao konflikte firma/pogon/lokacija ili duple nazive za nova ograničenja. Provjerite svježe stanje/backup baze prije produkcijske primjene.

Prijava Employee korisnika ostaje preko ID-a, kao u postojećem poslovnom modelu. Ona ne potvrđuje identitet lozinkom. Lozinke drugih uloga ostaju obavezne, a pokušaji prijave su ograničeni u bazi.

Upute za objavu i varijable su u `README.md` i `.env.example`. Tajne vrijednosti, node_modules i build izlaz nisu uključeni u paket.
