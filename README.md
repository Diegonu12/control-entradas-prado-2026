# Control de Entradas · Rural del Prado 2026 — Versión 2.0

Aplicación web responsive y PWA para registrar entregas desde celular y PC con sincronización mediante Firebase.

## Funciones

- Login con Firebase Authentication.
- Sincronización en tiempo real con Cloud Firestore.
- Cache offline de Firestore y PWA.
- Control de números duplicados.
- Aviso cuando un cliente ya tiene una entrada.
- Edición y eliminación.
- Búsqueda y filtros.
- Estadísticas y gráfico por día.
- Exportación CSV y respaldo JSON.
- Migración de datos antiguos de localStorage.
- Escáner QR/código de barras en navegadores compatibles.

## Configuración obligatoria en Firebase

### 1. Authentication

Firebase Console → Seguridad → Authentication → Método de acceso → Correo electrónico/contraseña → Habilitar.

Luego: Authentication → Usuarios → Agregar usuario.

### 2. Firestore

Firebase Console → Bases de datos y almacenamiento → Firestore Database → Crear base de datos.

En la pestaña **Reglas**, copiar el contenido de `firestore.rules` y presionar **Publicar**.

### 3. Dominios autorizados

Authentication → Configuración → Dominios autorizados. Verificar que figure:

- `localhost`
- `diegonu12.github.io`

## Publicar en GitHub

Desde la carpeta del proyecto:

```bash
git add .
git commit -m "Crea version 2.0 con Firebase"
git push
```

GitHub Pages debe estar configurado en Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

URL esperada:

`https://diegonu12.github.io/control-entradas-prado-2026/`

## Importante

La configuración pública de Firebase identifica el proyecto, pero la protección real depende de Authentication y las reglas de Firestore. No usar reglas abiertas (`allow read, write: if true`).
