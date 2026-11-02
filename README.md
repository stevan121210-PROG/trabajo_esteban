# CMD · Panel local

Aplicación React con interfaz oscura inspirada en CMD. Incluye una versión local con Express y SQLite, además de una demo pública de GitHub Pages que almacena sus ejemplos en el navegador.

## Publicar una demo en GitHub Pages

GitHub Pages no ejecuta React directamente desde `src/`: primero hay que compilar el proyecto. La compilación genera y copia a la raíz un único `index.html` autónomo, sin recursos adicionales.

### Publicación manual desde una rama

Para un repositorio publicado en `https://USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`, compila con el nombre exacto de tu repositorio:

```powershell
$env:VITE_DEMO_MODE = "true"
$env:GITHUB_REPOSITORY = "USUARIO/NOMBRE-DEL-REPOSITORIO"
npm.cmd run build
```

Después de compilar, el `index.html` de la raíz ya es autónomo. Confírmalo en GitHub en la rama que publica Pages: la página puede desplegarse desde la raíz de `main`, sin configurar Actions ni copiar la carpeta `assets/`.

La demo pública no tiene contraseña ni servidor: es una muestra, no una aplicación privada. Los datos se guardan únicamente en el almacenamiento del navegador de cada visitante; no se comparten entre visitantes y se pueden borrar al limpiar los datos del navegador. No introduzcas información personal real. Los pagos son registros ficticios; no se realizan cobros.

## Requisitos

- Node.js 20.19+ o 22.12+.
- npm.

## Iniciar en desarrollo

```bash
npm.cmd install
npm.cmd run dev
```

Abre `http://127.0.0.1:5173/dev.html`. La primera visita permite crear el usuario y la contraseña de administrador. No existe una contraseña predeterminada.

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
