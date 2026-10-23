// Errors returned by application endpoints; technical details remain in server logs.
export const errorTranslations: Record<string, [string, string, string]> = {
  Unauthorized: [
    "Potrebna je prijava",
    "Anmeldung erforderlich",
    "Debes iniciar sesión",
  ],
  Forbidden: [
    "Nemate dozvolu za ovu radnju",
    "Keine Berechtigung für diese Aktion",
    "No tienes permiso para esta acción",
  ],
  "Could not load company data. Please retry.": [
    "Podaci kompanije se nisu mogli učitati. Pokušajte ponovo.",
    "Unternehmensdaten konnten nicht geladen werden. Bitte erneut versuchen.",
    "No se pudieron cargar los datos de la empresa. Vuelve a intentarlo.",
  ],
  "Could not load dashboard counts. Please retry.": [
    "Statistika kontrolne table se nije mogla učitati. Pokušajte ponovo.",
    "Dashboard-Zahlen konnten nicht geladen werden. Bitte erneut versuchen.",
    "No se pudieron cargar las cifras del panel. Vuelve a intentarlo.",
  ],
  "Department name is required": [
    "Naziv odjela je obavezan",
    "Abteilungsname ist erforderlich",
    "El nombre del departamento es obligatorio",
  ],
  "Invalid or inactive plant": [
    "Neispravan ili neaktivan pogon",
    "Ungültiges oder inaktives Werk",
    "Planta no válida o inactiva",
  ],
  "Invalid plant": ["Neispravan pogon", "Ungültiges Werk", "Planta no válida"],
  "Department not found in your plant": [
    "Odjel nije pronađen u vašem pogonu",
    "Abteilung in Ihrem Werk nicht gefunden",
    "No se encontró el departamento en tu planta",
  ],
  "Could not update annual targets.": [
    "Godišnji ciljevi se nisu mogli ažurirati.",
    "Jahresziele konnten nicht aktualisiert werden.",
    "No se pudieron actualizar los objetivos anuales.",
  ],
  "XLSX or CSV file is required.": [
    "Potrebna je XLSX ili CSV datoteka.",
    "Eine XLSX- oder CSV-Datei ist erforderlich.",
    "Se requiere un archivo XLSX o CSV.",
  ],
  "Could not load import scope.": [
    "Obuhvat uvoza se nije mogao učitati.",
    "Importbereich konnte nicht geladen werden.",
    "No se pudo cargar el ámbito de importación.",
  ],
  "Invalid plant, Employee ID, name, department, role or annual target.": [
    "Neispravan pogon, ID zaposlenika, ime, odjel, uloga ili godišnji cilj.",
    "Ungültiges Werk, Mitarbeiter-ID, Name, Abteilung, Rolle oder Jahresziel.",
    "Planta, ID de empleado, nombre, departamento, rol u objetivo anual no válidos.",
  ],
  "Only Super Admin can import Super Admin users.": [
    "Samo super administrator može uvesti super administratore.",
    "Nur Superadministratoren können Superadministratoren importieren.",
    "Solo un superadministrador puede importar superadministradores.",
  ],
  "Employee not found.": [
    "Zaposlenik nije pronađen.",
    "Mitarbeiter nicht gefunden.",
    "Empleado no encontrado.",
  ],
  "Invalid role.": ["Neispravna uloga.", "Ungültige Rolle.", "Rol no válido."],
  "Only Super Admin can manage this user or role.": [
    "Samo super administrator može upravljati ovim korisnikom ili ulogom.",
    "Nur Superadministratoren können diesen Benutzer oder diese Rolle verwalten.",
    "Solo un superadministrador puede gestionar este usuario o rol.",
  ],
  "Department is not available in the selected plant.": [
    "Odjel nije dostupan u odabranom pogonu.",
    "Abteilung im ausgewählten Werk nicht verfügbar.",
    "El departamento no está disponible en la planta seleccionada.",
  ],
  "Invalid active value.": [
    "Neispravna vrijednost aktivnosti.",
    "Ungültiger Aktivstatus.",
    "Valor de actividad no válido.",
  ],
  "Could not save employee.": [
    "Zaposlenik se nije mogao sačuvati.",
    "Mitarbeiter konnte nicht gespeichert werden.",
    "No se pudo guardar el empleado.",
  ],
  "You cannot deactivate your own account.": [
    "Ne možete deaktivirati vlastiti račun.",
    "Sie können Ihr eigenes Konto nicht deaktivieren.",
    "No puedes desactivar tu propia cuenta.",
  ],
  "You cannot deactivate this user.": [
    "Ne možete deaktivirati ovog korisnika.",
    "Sie können diesen Benutzer nicht deaktivieren.",
    "No puedes desactivar a este usuario.",
  ],
  "Location name is required": [
    "Naziv lokacije je obavezan",
    "Standortname ist erforderlich",
    "El nombre de la ubicación es obligatorio",
  ],
  "Invalid department for this plant": [
    "Neispravan odjel za ovaj pogon",
    "Ungültige Abteilung für dieses Werk",
    "Departamento no válido para esta planta",
  ],
  "Location not found in your plant": [
    "Lokacija nije pronađena u vašem pogonu",
    "Standort in Ihrem Werk nicht gefunden",
    "No se encontró la ubicación en tu planta",
  ],
  "Invalid request body.": [
    "Neispravan sadržaj zahtjeva.",
    "Ungültiger Anfrageinhalt.",
    "Contenido de solicitud no válido.",
  ],
  "Valid plant name and code are required.": [
    "Potrebni su ispravan naziv i šifra pogona.",
    "Ein gültiger Werksname und Code sind erforderlich.",
    "Se requieren un nombre y un código de planta válidos.",
  ],
  "Could not create plant. Check its code and administrator details.": [
    "Pogon se nije mogao kreirati. Provjerite šifru i podatke administratora.",
    "Werk konnte nicht angelegt werden. Prüfen Sie Code und Administratordaten.",
    "No se pudo crear la planta. Revisa su código y los datos del administrador.",
  ],
  "Super Admin name is required.": [
    "Ime super administratora je obavezno.",
    "Name des Superadministrators ist erforderlich.",
    "El nombre del superadministrador es obligatorio.",
  ],
  "Super Admin password must contain 8 or more characters (maximum 72 bytes).":
    [
      "Lozinka super administratora mora imati najmanje 8 znakova (najviše 72 bajta).",
      "Das Superadministrator-Passwort muss mindestens 8 Zeichen enthalten (maximal 72 Bytes).",
      "La contraseña del superadministrador debe tener al menos 8 caracteres (máximo 72 bytes).",
    ],
  "Company is required.": [
    "Kompanija je obavezna.",
    "Unternehmen ist erforderlich.",
    "La empresa es obligatoria.",
  ],
  "Invalid Platform Owner credentials.": [
    "Neispravni podaci za prijavu vlasnika platforme.",
    "Ungültige Anmeldedaten des Plattformbetreibers.",
    "Credenciales del propietario de la plataforma no válidas.",
  ],
  "Owner login temporarily unavailable.": [
    "Prijava vlasnika je privremeno nedostupna.",
    "Betreiberanmeldung vorübergehend nicht verfügbar.",
    "El acceso del propietario no está disponible temporalmente.",
  ],
  "New password must be 12 or more characters (maximum 72 bytes).": [
    "Nova lozinka mora imati najmanje 12 znakova (najviše 72 bajta).",
    "Das neue Passwort muss mindestens 12 Zeichen enthalten (maximal 72 Bytes).",
    "La nueva contraseña debe tener al menos 12 caracteres (máximo 72 bytes).",
  ],
  "Setup session expired. Please sign in again.": [
    "Sesija podešavanja je istekla. Prijavite se ponovo.",
    "Die Einrichtungssitzung ist abgelaufen. Bitte erneut anmelden.",
    "La sesión de configuración ha caducado. Vuelve a iniciar sesión.",
  ],
  "Invalid request.": [
    "Neispravan zahtjev.",
    "Ungültige Anfrage.",
    "Solicitud no válida.",
  ],
  "Passwords must match and contain at least 12 characters (maximum 72 bytes).":
    [
      "Lozinke se moraju podudarati i imati najmanje 12 znakova (najviše 72 bajta).",
      "Passwörter müssen übereinstimmen und mindestens 12 Zeichen enthalten (maximal 72 Bytes).",
      "Las contraseñas deben coincidir y tener al menos 12 caracteres (máximo 72 bytes).",
    ],
  "Could not save password. Use a new password different from your Employee ID, or sign in again if your session expired.":
    [
      "Lozinka se nije mogla sačuvati. Koristite lozinku različitu od ID-a zaposlenika ili se ponovo prijavite ako je sesija istekla.",
      "Passwort konnte nicht gespeichert werden. Verwenden Sie ein anderes Passwort als Ihre Mitarbeiter-ID oder melden Sie sich bei abgelaufener Sitzung erneut an.",
      "No se pudo guardar la contraseña. Usa una distinta de tu ID de empleado o vuelve a iniciar sesión si ha caducado.",
    ],
  "Invalid push subscription": [
    "Neispravna pretplata na push obavijesti",
    "Ungültiges Push-Abonnement",
    "Suscripción push no válida",
  ],
  "Only an Admin or Super Admin can set Completed by.": [
    "Samo administrator ili super administrator može postaviti izvršioca.",
    "Nur Administratoren oder Superadministratoren können die abschließende Person festlegen.",
    "Solo un administrador o superadministrador puede establecer el responsable del cierre.",
  ],
  "A valid ESO, employee and report version are required.": [
    "Potrebni su ispravna ESO prijava, zaposlenik i verzija prijave.",
    "Gültige ESO-Meldung, Mitarbeiter und Meldungsversion sind erforderlich.",
    "Se requieren un ESO, un empleado y una versión de informe válidos.",
  ],
  "ESO changed. Refresh the detail and try again.": [
    "ESO prijava je promijenjena. Osvježite detalje i pokušajte ponovo.",
    "ESO wurde geändert. Aktualisieren Sie die Details und versuchen Sie es erneut.",
    "El ESO ha cambiado. Actualiza los detalles y vuelve a intentarlo.",
  ],
  "This employee or ESO is outside your allowed scope.": [
    "Ovaj zaposlenik ili ESO prijava je izvan vaših ovlasti.",
    "Dieser Mitarbeiter oder diese ESO-Meldung liegt außerhalb Ihres Zugriffsbereichs.",
    "Este empleado o ESO está fuera de tu ámbito de acceso.",
  ],
  "Invalid report ID": [
    "Neispravan ID prijave",
    "Ungültige Meldungs-ID",
    "ID de informe no válido",
  ],
  "Could not load report history. Please retry.": [
    "Historija prijava se nije mogla učitati. Pokušajte ponovo.",
    "Meldungsverlauf konnte nicht geladen werden. Bitte erneut versuchen.",
    "No se pudo cargar el historial de informes. Vuelve a intentarlo.",
  ],
  "Invalid page": [
    "Neispravna stranica",
    "Ungültige Seite",
    "Página no válida",
  ],
  "Invalid date range": [
    "Neispravan raspon datuma",
    "Ungültiger Datumsbereich",
    "Intervalo de fechas no válido",
  ],
  "Could not load reports. Please retry.": [
    "Prijave se nisu mogle učitati. Pokušajte ponovo.",
    "Meldungen konnten nicht geladen werden. Bitte erneut versuchen.",
    "No se pudieron cargar los informes. Vuelve a intentarlo.",
  ],
  "Dashboard counts unavailable": [
    "Statistika kontrolne table nije dostupna",
    "Dashboard-Zahlen nicht verfügbar",
    "Cifras del panel no disponibles",
  ],
  "ESO not found in your scope.": [
    "ESO prijava nije pronađena u vašem području pristupa.",
    "ESO-Meldung in Ihrem Zugriffsbereich nicht gefunden.",
    "No se encontró el ESO en tu ámbito de acceso.",
  ],
  "Invalid star value.": [
    "Neispravna vrijednost zvjezdice.",
    "Ungültiger Sternwert.",
    "Valor de estrella no válido.",
  ],
  "Refresh the ESO detail before saving.": [
    "Osvježite ESO detalje prije spremanja.",
    "Aktualisieren Sie die ESO-Details vor dem Speichern.",
    "Actualiza los detalles ESO antes de guardar.",
  ],
  "Could not update ESO.": [
    "ESO prijava se nije mogla ažurirati.",
    "ESO konnte nicht aktualisiert werden.",
    "No se pudo actualizar el ESO.",
  ],
  "Could not load ESO.": [
    "ESO prijava se nije mogla učitati.",
    "ESO konnte nicht geladen werden.",
    "No se pudo cargar el ESO.",
  ],
  "Photo upload failed. Please try again.": [
    "Slanje fotografije nije uspjelo. Pokušajte ponovo.",
    "Foto-Upload fehlgeschlagen. Bitte erneut versuchen.",
    "No se pudo subir la foto. Vuelve a intentarlo.",
  ],
  "Invalid date": ["Neispravan datum", "Ungültiges Datum", "Fecha no válida"],
  "Start date must be before end date": [
    "Početni datum mora biti prije završnog",
    "Das Startdatum muss vor dem Enddatum liegen",
    "La fecha inicial debe ser anterior a la final",
  ],
  "Session service unavailable.": [
    "Usluga sesije nije dostupna.",
    "Sitzungsdienst nicht verfügbar.",
    "Servicio de sesión no disponible.",
  ],
  "Could not revoke session. Please try logging out again.": [
    "Sesija se nije mogla završiti. Pokušajte se ponovo odjaviti.",
    "Sitzung konnte nicht beendet werden. Bitte erneut abmelden.",
    "No se pudo cerrar la sesión. Intenta salir de nuevo.",
  ],
  "Could not verify session.": [
    "Sesija se nije mogla provjeriti.",
    "Sitzung konnte nicht überprüft werden.",
    "No se pudo verificar la sesión.",
  ],
  "Could not verify owner session.": [
    "Sesija vlasnika se nije mogla provjeriti.",
    "Betreibersitzung konnte nicht überprüft werden.",
    "No se pudo verificar la sesión del propietario.",
  ],
  "Could not verify plant.": [
    "Pogon se nije mogao provjeriti.",
    "Werk konnte nicht überprüft werden.",
    "No se pudo verificar la planta.",
  ],
  "Import file must be below 2 MB.": [
    "Datoteka za uvoz mora biti manja od 2 MB.",
    "Importdatei muss kleiner als 2 MB sein.",
    "El archivo de importación debe ser menor de 2 MB.",
  ],
  "Workbook has no sheets.": [
    "Radna sveska nema listova.",
    "Arbeitsmappe enthält keine Tabellenblätter.",
    "El libro no contiene hojas.",
  ],
  "Import supports up to 2000 employees and 32 columns.": [
    "Uvoz podržava do 2000 zaposlenika i 32 kolone.",
    "Der Import unterstützt bis zu 2000 Mitarbeiter und 32 Spalten.",
    "La importación admite hasta 2000 empleados y 32 columnas.",
  ],
  "Invalid column name.": [
    "Neispravan naziv kolone.",
    "Ungültiger Spaltenname.",
    "Nombre de columna no válido.",
  ],
  "Import cell is too large.": [
    "Ćelija za uvoz je prevelika.",
    "Importzelle ist zu groß.",
    "La celda de importación es demasiado grande.",
  ],
  "Use an XLSX file. Convert older XLS files to XLSX first.": [
    "Koristite XLSX datoteku. Starije XLS datoteke prvo pretvorite u XLSX.",
    "Verwenden Sie eine XLSX-Datei. Konvertieren Sie ältere XLS-Dateien zuerst in XLSX.",
    "Utiliza un archivo XLSX. Convierte antes los archivos XLS antiguos a XLSX.",
  ],
  "Expected a list.": [
    "Očekivana je lista.",
    "Eine Liste wurde erwartet.",
    "Se esperaba una lista.",
  ],
  "Workbook archive is too complex.": [
    "Struktura radne sveske je previše složena.",
    "Die Arbeitsmappenstruktur ist zu komplex.",
    "La estructura del libro es demasiado compleja.",
  ],
  "Invalid workbook archive.": [
    "Neispravna datoteka radne sveske.",
    "Ungültige Arbeitsmappendatei.",
    "Archivo de libro no válido.",
  ],
  "Unsupported workbook archive.": [
    "Nepodržana datoteka radne sveske.",
    "Nicht unterstützte Arbeitsmappendatei.",
    "Archivo de libro no compatible.",
  ],
  "Workbook expands beyond 20 MB.": [
    "Raspakovana radna sveska prelazi 20 MB.",
    "Die entpackte Arbeitsmappe überschreitet 20 MB.",
    "El libro descomprimido supera los 20 MB.",
  ],
  "Invalid or oversized workbook archive.": [
    "Neispravna ili prevelika radna sveska.",
    "Ungültige oder zu große Arbeitsmappe.",
    "Libro no válido o demasiado grande.",
  ],
  "Unsupported workbook compression.": [
    "Nepodržana kompresija radne sveske.",
    "Nicht unterstützte Arbeitsmappenkomprimierung.",
    "Compresión de libro no compatible.",
  ],
  "Invalid workbook entry size.": [
    "Neispravna veličina stavke radne sveske.",
    "Ungültige Größe eines Arbeitsmappeneintrags.",
    "Tamaño de entrada del libro no válido.",
  ],
  "Platform Owner credentials are not configured.": [
    "Podaci za prijavu vlasnika platforme nisu podešeni.",
    "Anmeldedaten des Plattformbetreibers sind nicht eingerichtet.",
    "Las credenciales del propietario de la plataforma no están configuradas.",
  ],
  "Login temporarily unavailable. Check the server configuration and database migration.":
    [
      "Prijava je privremeno nedostupna. Provjerite postavke servera i migraciju baze.",
      "Anmeldung vorübergehend nicht verfügbar. Prüfen Sie Serverkonfiguration und Datenbankmigration.",
      "El acceso no está disponible temporalmente. Revisa la configuración del servidor y la migración de la base de datos.",
    ],
  "Employee import unavailable. Check the V6.2.2 database migration.": [
    "Uvoz zaposlenika nije dostupan. Provjerite migraciju baze V6.2.2.",
    "Mitarbeiterimport nicht verfügbar. Prüfen Sie die Datenbankmigration V6.2.2.",
    "La importación de empleados no está disponible. Revisa la migración V6.2.2.",
  ],
  "Database upgrade required. Apply the latest ESO migration.": [
    "Potrebna je nadogradnja baze. Primijenite najnoviju ESO migraciju.",
    "Datenbankaktualisierung erforderlich. Wenden Sie die neueste ESO-Migration an.",
    "Se requiere actualizar la base de datos. Aplica la última migración ESO.",
  ],
  "Could not load photos and audit. Check the V6.2.2 database migration.": [
    "Fotografije i historija aktivnosti se nisu mogli učitati. Provjerite migraciju V6.2.2.",
    "Fotos und Prüfprotokoll konnten nicht geladen werden. Prüfen Sie die Migration V6.2.2.",
    "No se pudieron cargar las fotos y la auditoría. Revisa la migración V6.2.2.",
  ],
  "Session service unavailable. Check the V6.2.2 database migration.": [
    "Usluga sesije nije dostupna. Provjerite migraciju baze V6.2.2.",
    "Sitzungsdienst nicht verfügbar. Prüfen Sie die Datenbankmigration V6.2.2.",
    "El servicio de sesión no está disponible. Revisa la migración V6.2.2.",
  ],
  "Login service unavailable. Check the V6.2.2 database migration.": [
    "Usluga prijave nije dostupna. Provjerite migraciju baze V6.2.2.",
    "Anmeldedienst nicht verfügbar. Prüfen Sie die Datenbankmigration V6.2.2.",
    "El servicio de acceso no está disponible. Revisa la migración V6.2.2.",
  ],
};
