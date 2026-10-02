# ESO 6.2.3 — paket za Vercel

Ova verzija nadograđuje postojeću ESO 6.2.2 bazu. Zadržava prijavu Employee korisnika preko ID-a, teme, jezike i postojeće tokove. Ne briše podatke.

## Prije objave

1. Na postojećoj ESO bazi migracije se izvršavaju jednom i redom: `20260928183757_eso_v621_editing_photos_locations.sql`, `20260929224313_eso_v622_security_sessions_atomic_workflows.sql`, zatim `20261001220000_eso_v623_completion_attribution.sql`. Historijske SQL fajlove ne ponavljajte. Produkcijska baza ovog projekta već ima sve tri migracije; na drugoj bazi provjerite historiju prije primjene.
2. Sačuvajte postojeće Vercel varijable. Obavezne su `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` ili `SUPABASE_SERVICE_ROLE_KEY`, te `APP_SESSION_SECRET` s najmanje 32 nasumična bajta. Primjer imena je u `.env.example`; tajne vrijednosti nisu u paketu.
3. Za Owner panel postavite `PLATFORM_OWNER_ID` i jedinstvenu `PLATFORM_OWNER_PASSWORD` od najmanje 12 znakova. Za dnevne podsjetnike postavite `CRON_SECRET`. Postojeće VAPID ključeve zadržite da push nastavi raditi.
4. U GitHub/Vercel projektu zamijenite izvorne fajlove sadržajem ovog paketa. Root Directory mora biti folder s `package.json`. Framework: Next.js; Node: 24.x; Install: `npm ci`; Build: `npm run build`.
5. Objavite i ponovo se prijavite. Stari kolačići se ne prihvataju u ovoj verziji. Provjerite jednu prijavu, uređivanje ESO-a, fotografije i završetak zadatka na svom deploymentu.

Nasumični secret možete napraviti lokalno:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Upotrijebite različite vrijednosti za APP_SESSION_SECRET i CRON_SECRET. Server ključ, lozinke i tajne varijable nemaju prefiks `NEXT_PUBLIC_`.

## Šta je popravljeno

- Javni pristup tabelama i privilegovanim RPC funkcijama je zatvoren SQL migracijom; RLS ostaje bez javnih politika jer aplikacija koristi provjereni serverski pristup.
- Sesije su nasumične, spremljene kao hash, ističu nakon 12 sati i opozivaju se pri odjavi, promjeni lozinke, uloge ili aktivnosti firme/pogona.
- Provjere firme i pogona rade i u aplikaciji i kroz ograničenja baze. Employee ID koji je dvosmislen između firmi odbija se na root prijavi; koristite `/c/COMPANYCODE`.
- ESO izmjene i dodjele zadataka koriste transakcije i provjeru verzije. Nedostajuća migracija zaustavlja upis; nema nesigurnog rezervnog upisa ni automatskog prepisivanja tuđih izmjena. Admin/Super Admin može sigurno postaviti `Completed by` za već završen ESO urađen van aplikacije; status, datum i audit ostaju sačuvani.
- Dashboard ima klikabilan Top ESO Resolver koji otvara njegove završene ESO zapise, Top ESO Reporters koji otvaraju prijave izabrane osobe, Top Resolver je 50/50 uz Employee with Most ESO, a tabela prikazuje `Completed by`. `CRITICAL OPEN` i `OVERDUE` su 50/50 iznad tih kartica na mobilnom i desktop prikazu, a overdue tabela prikazuje `Overdue by`. KPI i department prozori podržavaju filtere po datumu (`From/To`), departmentu, lokaciji, statusu, urgentnosti i `Safety`/`Environmental` kategoriji. `In Progress` zapisi prikazuju `Assigned To`. Dodato je i ručno osvježavanje dashboarda.
- Uklonjene fotografije ne vraćaju se korisniku; upload provjerava tip, sadržaj i ukupnu veličinu. Dodatne lokacije se čuvaju i mogu uređivati.
- Prebacivanje u Voice of Employee i dodjela zvjezdice su transakcijski, s historijom. Podsjetnici traže tajnu i ne dupliraju obavijesti.
- Ranjiva XLSX biblioteka zamijenjena je ExcelJS-om. Import podržava XLSX/CSV; stariji XLS treba sačuvati kao XLSX. CSV izvoz neutralizira formule; uvoz je ograničen na 2 MB i 2000 redova.
- API odgovori su privatni i ne keširaju se. Dodane su provjere porijekla zahtjeva i sigurnosna zaglavlja. Fiskalni datumi su usklađeni s Europe/Sarajevo.

Employee prijava samo ID-om zadržava raniji poslovni model: ona ne potvrđuje identitet lozinkom. Lozinke svih ostalih uloga ostaju obavezne. Novim/izmijenjenim privilegovanim računima lozinka mora imati najmanje 8 znakova i najviše 72 bajta.

## Provjere

```sh
npm ci
npm run check:env
npm run typecheck
npm test
npm run test:database
npm run test:routes
npm run build
```

Testovi koriste sintetičke podatke i ne mijenjaju produkciju. Browser provjera je u `tests/ui-smoke.cjs`; zahtijeva Playwright i lokalno pokrenut build. Rezultati završnih provjera i tačno stanje baze navedeni su u `PROVJERE.md`.

Objava na stvarnom Vercel projektu, stvarna prijava korisničkim lozinkama, fizički upload u produkcijski Storage i dostava push obavijesti zahtijevaju provjeru poslije deploymenta. Paket ne sadrži stvarne server ključeve niti korisničke lozinke.
