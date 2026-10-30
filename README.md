# Metro Contable v2
Abrir `www/index.html` en Chrome/Edge/Firefox. Portales (usuario / contraseña):
- Portal Suba: `suba` / `Suba#2026`
- Portal Norte: `norte` / `Norte#2026`
- Portal Américas: `americas` / `Americas#2026`

Cada sesión solo ve y registra operaciones de su portal.

## Icono en el escritorio (computador)
- **Rápido (Windows):** doble clic en `Instalar-acceso-escritorio.bat`; crea el icono "Metro Contable" que abre la app en su propia ventana.
- **Instalador .exe:** Actions → "Build APK y Escritorio" → descargar `metro-contable-windows-instalador` (crea el icono al instalar).
- **Desde el navegador:** publicar `www/` en https y usar el botón "Instalar" de Chrome/Edge.

## APK (Android)
1. Sube esta carpeta a un repositorio de GitHub.
2. Pestaña **Actions → Build APK → Run workflow**.
3. Descarga `metro-contable-apk` (contiene `app-debug.apk`) e instálalo en el celular (permitir "orígenes desconocidos").

Alternativa sin APK: publica `www/` en un hosting https (GitHub Pages) y en el celular usa "Añadir a pantalla de inicio" (PWA).

## Alcance y límites
Prototipo académico. La autenticación es del lado del cliente (contraseñas con PBKDF2, bloqueo tras 5 intentos, cierre por inactividad); no sustituye un servidor. Los datos se guardan en el dispositivo: usa la copia de seguridad JSON de Configuración.
