# ESO 6.2.4

## ESO HUNT

- ESO HUNT je zaseban ribbon/statistički modul. Home ekran, redovni ESO obrazac, historija i postojeći workflow ne mijenjaju se.
- Super Admin kreira događaj, definiše miješane timove nevezane za department i svakom korisniku može dodijeliti najviše jedan tim u fiskalnoj godini.
- Start zaključava roster i pokreće server-controlled prozor od 60 minuta. Samo prijave članova timova u tom periodu i izabranom opsegu automatski se povezuju s Hunt eventom.
- Jedna ESO prijava ostaje jedan red u bazi; Hunt čuva samo vezu na postojeću prijavu. Radnici koji nisu u timu nastavljaju prijavljivati normalno i njihove prijave se ne pojavljuju u Hunt statistici.
- Liderboard tokom događaja je privremen. Super Admin nakon isteka ručno označava `Accepted`, `Duplicate` ili `Not ESO`; duplikati se ne brišu, ali ne ulaze u konačan rezultat.
- Timovi imaju godišnji leaderboard kroz fiskalnu godinu, a privatnost je ograničena na vlastiti tim za obične korisnike; Super Admin vidi kompletan pregled i review queue.

## Cohort closure rate

- Dashboard sada prikazuje tri omjera: tekuća sedmica, kalendarski mjesec i tekuća fiskalna godina.
- Brojilac je broj ESO zapisa prijavljenih u tom periodu koji su zatvoreni do kraja perioda; nazivnik je broj svih prijavljenih zapisa iz iste kohorte. Prikazani su i `closed`, `reported` i `open`.

## Baza i sigurnost

- Dodane su RLS-zaštićene HUNT tabele bez privilegija za `anon`/`authenticated`; aplikacija ih čita i mijenja samo preko provjerenog server-side sessiona.
- Trigger na `eso_reports` je additive-only i automatski veže prijavu samo kada su event live, reporter član tima, scope odgovara i timestamp je unutar 60 minuta.
- Dodani su indeksi za Hunt event/team/review upite i korekcija triggera je provjerena transakcijskim smoke testom na produkcijskoj strukturi bez trajnih sintetičkih redova.

## Provjere

- `npm run typecheck` — prošao.
- `npm test` — 34/34.
- `npm run test:database` — 31/31.
- `npm run test:routes` — 20 API provjera, 34 zaštićene metode.
- Produkcijski `npm run build` — prošao.
- Produkcijski Supabase: HUNT migracija, korektivna trigger/index migracija i rollback smoke test — prošli.
