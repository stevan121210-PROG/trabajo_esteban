# CMD · Panel local

Aplicación local hecha con React, Express y SQLite para administrar personas y registrar pagos ficticios. El panel tiene una interfaz oscura inspirada en CMD.

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
