# ESO 6.2.3

## Dashboard

- Top ESO Resolver i Employee with Most ESO prikazani su kao dva jednaka 50/50 KPI panela.
- Klik na resolvera otvara ESO zapise koje je riješio u tekućoj fiskalnoj godini.
- Completed ESO tabela prikazuje `Completed by: ime`, uključujući `Not recorded` dok admin ne dopuni stare zapise.
- Dashboard ima ručni REFRESH sa zaštitom od dvostrukog klika.
- `CRITICAL OPEN` i `OVERDUE` su spojeni u isti 50/50 red na mobilnom i desktop pregledu, dok su četiri osnovna KPI-ja uredno raspoređena iznad.
- Overdue lista uz zaposlenog prikazuje `Overdue by: ime` (ili `Not assigned` kada nema dodijeljenog izvršioca).
- Dashboard sada prikazuje `CRITICAL OPEN` i `OVERDUE` iznad Top Resolver/Employee kartica; Top ESO Reporters su klikabilni i otvaraju prijave izabrane osobe.
- KPI i department prikazi imaju filtere za sve statuse, urgentnosti i kategorije (`Safety` / `Environmental`).
- Reports/KPI filteri sada uključuju period `From/To`, department i lokaciju.
- `In Progress` redovi u tabelama jasno prikazuju `Assigned To: ime • uloga`.

## Administracija završenih ESO zapisa

- Admin i Super Admin mogu u detaljima završenog ESO-a izabrati aktivnog zaposlenog iz istog pogona kao `Completed by`.
- Operacija ne otvara ESO ponovo i ne mijenja originalni completion datum/status.
- Upis je optimistički zaključan verzijom izvještaja i ostavlja audit događaj `set_completion_resolver`.
- Baza odbija neovlaštene uloge, pogrešan pogon/firma, neaktivne zaposlenike i zastarjelu verziju.

## Provjere

- `npm run typecheck` prošao.
- `npm test` prošao: 33/33.
- `npm run test:database` prošao: 31/31, uključujući retroaktivnu atribuciju.
- `npm run test:routes` prošao: 20 API provjera i 32 zaštićene metode.
- Produkcijski Next.js build prošao je sa Vercel environment placeholder varijablama; stvarni deployment i prijava se provjeravaju nakon upload-a.
