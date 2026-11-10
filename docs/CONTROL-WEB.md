# Control Web — administración del tour 360°

**URL canónica:** `/{orgSlug}/{tourSlug}/control-web/`  
Ej.: `http://127.0.0.1:8081/orbe/sandbox/control-web/`

**Acceso:** solo editores con sesión + membresía (`orgAdmin` | `tourEditor`) en esa org.  
Sin sesión → redirect a `/plataforma/login.html?return=…`.  
Cuenta de otra org → **Acceso denegado** (sin modos ni panoramas).  
Detalle: [docs/producto/52-control-web-authz.md](./producto/52-control-web-authz.md).

**Producto:** Orbe360 Control Web. El chrome es Orbe; el chip de cliente viene de TourBranding.

## Modos (tras autorización)

| Modo | Qué permite |
|------|-------------|
| **Ver** | Explorar listado, grafo y vista 360° sin modificar |
| **Editar escenas** | Añadir / editar título y zona (metadatos) |
| **Editar hotspots** | Colocar enlaces e info, crear conexiones en el grafo |

## Colocar un hotspot (recomendado)

1. Modo **Editar hotspots**.
2. Elige la escena.
3. **Gira la vista 360°** hasta mirar exactamente hacia donde debe ir el triángulo.
4. Elige destino + sector (Adelante / Atrás / Diagonal / Arriba / Abajo).
5. Pulsa **Colocar en el centro de la vista**.
6. **Aplicar escena al grafo** → **Guardar cambios** → **Exportar JSON**.

No se crea retorno automático A↔B (evita bucles).

## Guardado seguro

- Badge **Cambios sin guardar**.
- Aviso al cerrar la pestaña con cambios pendientes.
- Sync a Convex (`tourAdmin:saveTourSnapshot` con `orgSlug`) + copia local keyed por org+tour.
- Guard anti-wipe: snapshot vacío no borra conexiones existentes sin confirmación.

## Tour público (sin editor)

`/{org}/{tour}/` puede ser público. Control Web **nunca** lo es.
