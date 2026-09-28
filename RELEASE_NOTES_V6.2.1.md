# ESO V6.2.1 — Editing, self-resolve, fotografije i lokacije

Osnova: originalni `ESO_StackBlitz_Release_v6.1.5_ESO_CATEGORY_FIX.zip`, pronađen u istom folderu kao dostavljeni V6.1 ZIP. Nadogradnja zadržava V6.1.3 performance i V6.1.4 nested-modal popravke te V6.1.5 canonical category fix.

## Šta je uključeno

- **Edit ESO:** opis, kategorija, importance/urgency, primary location, additional locations i Before fotografije. Izmjena ostavlja originalni datum i autora prijave.
- **Edit completion:** korekcija opisa radova i After fotografija, uključujući završene prijave. Originalni `completed_by` i datum završetka ostaju sačuvani; audit bilježi osobu koja radi korekciju.
- **Self-take / self-resolve:** Maintenance, Supervisor i Management mogu otvoriti nepridruženu prijavu iz svog planta i kliknuti TAKE TASK ili TAKE & RESOLVE. Tuđi dodijeljeni zadatak ne može se preuzeti. Admin ima odvojenu akciju preraspodjele.
- **Više fotografija:** do 8 aktivnih Before i 8 After fotografija. Kamera, izbor više fotografija, preview, uklanjanje i zamjena. Obrada ide sekvencijalno radi memorije mobilnog uređaja; cilj je do 400 KB po fotografiji i ukupno ispod 3.5 MB po zahtjevu.
- **Lokacije:** jedna glavna i do 20 dodatnih iz istog company/plant opsega. Stara glavna lokacija i postojeće fotografije ostaju sačuvane. Fotografije pripadaju ESO prijavi; povezivanje pojedinačne fotografije s pojedinačnom lokacijom nije dio ovog paketa.
- **Activity / Audit:** za nove create/edit/assign/take/start/complete/edit-completion akcije čuvaju se autor, vrijeme i prethodne/nove vrijednosti. Audit je append-only za serversku ulogu. Starija status historija je prikazana odvojeno; retroaktivna historija izmjena nije izmišljena. Postojeći Star/VoE tokovi ostaju u svom ranijem modelu historije.
- **Konkurentne izmjene:** zaključavanje jedne prijave i broj revizije sprječavaju da drugi korisnik tiho prepiše noviju izmjenu. Konflikt traži osvježavanje detalja i ponovni pregled izmjena.
- **Transakcija:** ESO, zadatak, attachment metapodaci, additional locations i audit snimaju se zajedno. SQL greška vraća sve DB izmjene.
- **UX i performance:** slike se potpisuju tek pri otvaranju detalja, u jednom batch zahtjevu. Audit se učitava po 30 događaja. Osvježavanje prijave više ne demontira cijelu aplikaciju niti zatvara roditeljski KPI/Department prozor.
- **Privatni keš:** service worker više ne kešira API odgovore i potpisane Storage URL-ove; stari ESO shell keš se uklanja pri aktivaciji nove verzije.
- **Login prije migracije:** početno učitavanje dashboarda više ne traži `removed_at`, pa se korisnik može prijaviti i prije izvršenja V6.2.1 migracije. Edit/audit detalj se koristi nakon migracije.
- Next.js ažuriran sa 15.5.9 na sigurnosni patch 15.5.26. Verzije produkcijskih zavisnosti su zaključane i uključen je `package-lock.json`.

## Prava pristupa

| Uloga | Edit prijave / Before | Take i complete | Edit completion / After |
|---|---|---|---|
| Employee | Vlastite prijave | Ne | Ne |
| Maintenance / Supervisor | Vlastite prijave | Nepridružene ili vlastiti zadaci, isti plant | Ako je dodijeljeni izvršilac ili recorded resolver |
| Management | Prijave u svom plantu | Nepridružene ili vlastiti zadaci | Ako je dodijeljeni izvršilac ili recorded resolver |
| Admin | Prijave u svom plantu | Može dodijeliti, preraspodijeliti i završiti | Da, u svom plantu |
| Super Admin | Unutar svoje kompanije | Unutar svoje kompanije | Unutar svoje kompanije |

Maintenance i Supervisor sada mogu vidjeti ESO prijave svog planta, što omogućava izbor dostupnog zadatka. Employee i dalje vidi samo svoje prijave. Prava se provjeravaju serverski i ponovo u SQL funkciji. Company/plant i actor se ne prihvataju kao autoritet iz browsera.

## Migracija i deploy

**Produkcijska baza nije mijenjana tokom ove izrade. ZIP sadrži pripremljenu migraciju.**

1. Sačuvati backup baze i prethodni V6.1.5 deploy. Prvo probati na staging kopiji postojećeg ESO projekta.
2. Na postojećoj V6.1.5 bazi izvršiti **samo** `supabase/migrations/20260928183757_eso_v621_editing_photos_locations.sql`, kao jedan SQL skript. Migracija je jednokratna i transakcijska. Nema brisanja postojećih prijava, fotografija ni promjene FY podataka.
3. **Ne izvršavati stari `supabase/schema.sql` niti ponavljati stare migracije.** Taj starter u naslijeđenom ZIP-u nije isti kao aktivna multi-company/plant shema. Novi paket nije samostalan bootstrap prazne baze.
4. Raspakovati ZIP u projekat, zadržati postojeće serverske environment varijable iz V6.1.5. Nisu potrebni novi tajni ključevi. Nikad stavljati service-role/secret ključ u `NEXT_PUBLIC_*` varijablu.
5. Instalirati sa `npm ci`, provjeriti `npm test`, zatim `npm run build`. Za Vercel koristiti postojeći Next.js deployment postupak. ZIP sadrži izvorni projekat; `node_modules`, `.next` i privatni `.env` nisu uključeni.
6. Nakon objave zatvoriti stare tabove i ponovo otvoriti aplikaciju. Stari maintenance zahtjev bez revizije namjerno se odbija umjesto da prepiše novije podatke.
7. Provjeriti na stagingu stvarni login, upload na privatni bucket `eso-attachments`, pregled Before/After slika, edit već završene prijave, push obavijesti i pristup iz dvije kompanije/planta. Ti integracijski koraci nisu izvršeni nad produkcijom u ovoj sesiji.

SQL provjera nakon migracije:

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='eso_reports' and column_name='revision';
select to_regprocedure('public.eso_mutate_v621(uuid,uuid,text,integer,jsonb)');
select has_function_privilege('anon', 'public.eso_mutate_v621(uuid,uuid,text,integer,jsonb)', 'execute') as anon_can_execute,
       has_function_privilege('authenticated', 'public.eso_mutate_v621(uuid,uuid,text,integer,jsonb)', 'execute') as authenticated_can_execute;
-- Očekivanje: kolona postoji, funkcija postoji, obje dozvole su false.
```

## Provjere

- TypeScript provjera prolazi.
- 22 lokalna testa prolaze: canonical vrijednosti, prava i company/plant scope, SQL migracija, rollback pri nevaljanoj fotografiji, audit, revizijski konflikt, self-take, self-resolve, očuvanje resolvera/datuma, nevaljana uklanjanja fotografija i zabrana pristupa RPC-u za anon/authenticated uloge.
- SQL testovi koriste izolovani PostgreSQL engine PGlite i sintetičku V6.1.5 shemu relevantnih tabela, provjerenu prema dostupnoj produkcijskoj metapodacima. Nisu zamjena za staging test na punoj bazi niti test stvarnog paralelnog opterećenja.
- Automatizovani Edge/Playwright UI test prolazi: KPI → detalj → edit → save → self-resolve s dvije slike → zatvaranje detalja vraća isti KPI; canonical kategorija i dodatna lokacija u requestu; desktop/mobilni prikaz bez horizontalnog overflowa i bez browser runtime grešaka. API odgovori u UI testu su mock podaci.
- Produkcijski Next.js build je provjeren s placeholder environment varijablama. Stvarni Storage upload, push i produkcijski deployment nisu izvršeni.

## Operativne napomene i postojeći rizici

- Uklonjene fotografije su soft-deleted u metapodacima i ne prikazuju se u galeriji. Fizički fajl ostaje u privatnom bucketu radi očuvanja evidencije. Ne postoji automatska politika čišćenja u ovom releaseu.
- Ako upload uspije, a DB vrati poznatu grešku, novi fajlovi se uklanjaju. Kod prekida veze tokom DB poziva ishod može biti nepoznat; fajlovi se tada zadržavaju da se ne bi obrisala uspješno vezana fotografija. Mogu ostati privatni orphan fajlovi za kasniju provjeru.
- Poziv za potpisanu fotografiju traje do jednog sata; već izdan link može ostati važeći do isteka nakon soft-removal. Refresh detalja izdaje nove linkove samo za aktivne fotografije.
- **Naslijeđeni Supabase sigurnosni nalazi:** `plants` i `platform_owners` imaju isključen RLS; `eso_tenant_integrity` je security-definer view; `admin_reset_eso_password` i `platform_create_company` su među privileged funkcijama dostupnim anon/authenticated ulogama. Potrebno ih je pregledati i zatvoriti prije produkcijske objave. Ovaj feature paket ne primjenjuje promjene privilegija na te stare objekte. Novi RPC je isključivo za `service_role`, a nove tabele imaju RLS i nemaju browser pristup.
- RLS bez politika na ostalim postojećim tabelama odgovara serverskom modelu aplikacije: klijenti ne pristupaju direktno tim tabelama. Provjeriti grantove odvojeno od samog RLS statusa.
- Online npm audit nakon Next patcha i dalje prijavljuje 4 stavke: Next/PostCSS (uključujući tranzitivnu stavku), sharp i stari xlsx. Kritični Next nalaz je uklonjen; postojeće high/moderate stavke nisu proglašene riješenim. Potrebna je zasebna provjera zavisnosti, posebno Excel importa, prije šire produkcijske upotrebe.

Reference: [Supabase RLS nalazi](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public), [javno dostupne privileged funkcije](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [funkcijske privilegije](https://supabase.com/docs/guides/database/functions).

## Izvan ovog releasea

V6.2.2/V6.2.3 nisu implementirani: novi analytics moduli, profilne/lokacijske slike, tema, Contact i FY pilot prebacivanje ostaju za naredne dogovorene faze. Postojeća statistika i FY obračun nisu mijenjani.

## Povratak na staru verziju

Kod V6.1.5 može se vratiti uz zadržavanje novih tabela/kolona. Ne brisati audit ni fotografije radi rollbacka. Stari frontend može prikazati samo jednu sliku i ne razumije soft-deletion; stare write putanje ne stvaraju novi audit. Zbog toga rollback raditi u kontrolisanom periodu, a nakon povratka na V6.2.1 provjeriti izmjene nastale u međuvremenu.
