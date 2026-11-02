# CMD · Panel local

Aplicación React con interfaz oscura inspirada en CMD. Incluye una versión local con Express y SQLite, además de una demo pública de GitHub Pages que almacena sus ejemplos en el navegador.

## Publicar una demo en GitHub Pages

GitHub Pages no ejecuta React directamente desde `src/`: primero hay que compilar el proyecto y publicar los archivos resultantes. **No publiques el `index.html` de la raíz**; ese archivo es la entrada de desarrollo y hace que la página quede en blanco si se sirve sin compilar.

### Publicación manual desde una rama

La compilación genera un único archivo `dist/index.html` con JavaScript y CSS incluidos. Así puedes publicarlo sin subir una carpeta de recursos adicional. Para un repositorio publicado en `https://USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`, compila con el nombre exacto de tu repositorio:

```powershell
$env:VITE_DEMO_MODE = "true"
$env:GITHUB_REPOSITORY = "USUARIO/NOMBRE-DEL-REPOSITORIO"
npm.cmd run build
```

En GitHub, abre `dist/index.html` de tu computadora y copia todo su contenido al `index.html` de la raíz del repositorio. Confirma los cambios y espera a que termine el despliegue de Pages. El HTML es autónomo y no depende de archivos en `assets/`.

### Publicación automática con GitHub Actions

Alternativamente, sube el proyecto completo, incluido `src/`, `package.json`, `package-lock.json`, `vite.config.js` y `.github/workflows/deploy.yml`. En **Settings → Pages → Build and deployment → Source**, selecciona **GitHub Actions**. Publica los cambios en `main` o `master` y verifica que termine correctamente **Deploy GitHub Pages** en **Actions**.

La demo pública no tiene contraseña ni servidor: es una muestra, no una aplicación privada. Los datos se guardan únicamente en el almacenamiento del navegador de cada visitante; no se comparten entre visitantes y se pueden borrar al limpiar los datos del navegador. No introduzcas información personal real. Los pagos son registros ficticios; no se realizan cobros.

## Requisitos

- Node.js 20.19+ o 22.12+.
- npm.

## Iniciar en desarrollo

```bash
npm.cmd install
npm.cmd run dev
```

Abre la dirección local que muestra Vite, normalmente `http://127.0.0.1:5173`. La primera visita permite crear el usuario y la contraseña de administrador. No existe una contraseña predeterminada.

En una terminal que admita `npm` directamente también puedes usar `npm install` y `npm run dev`.

## Ejecutar una compilación local

```bash
npm.cmd run build
npm.cmd start
```

Abre `http://127.0.0.1:3001`.

## Datos y pagos

- SQLite se crea automáticamente en `data/app.sqlite`, junto al proyecto.
- La base se conserva al cerrar y volver a iniciar la aplicación. La carpeta `data/` no se incluye en Git.
- El directorio permite agregar, editar, buscar y eliminar personas.
- Los pagos son **demostraciones locales**: solo registran una transacción ficticia. No se conectan con un proveedor, banco ni pasarela, y nunca solicitan información de tarjetas.
- Si eliminas una persona, sus pagos permanecen en el historial sin asociación.
- El panel escucha solo en `127.0.0.1` y no requiere servidor externo.
- Cerrar sesión o reiniciar el servidor invalida la sesión actual.
