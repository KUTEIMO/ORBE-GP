# Versión estable — 2026-10-06

Punto de restauración del producto **Orbe360** tomado antes de iniciar la implementación del plan de rediseño de landing y subpáginas B2B.

---

## 1. Dónde quedó el punto de restauración

### 1.1 Rama de respaldo en Git
| Referencia | Valor |
|-----------|-------|
| Rama de respaldo | `backup/estable-2026-10-06` |
| Estado | Preserva el estado base previo al rediseño B2B |

### 1.2 Archivos de respaldo físico — `backups/estable-2026-10-06/`
| Archivo | Contenido |
|---------|-----------|
| `orbe-codigo-estable-2026-10-06.zip` (~52.5 MB) | Árbol completo del repositorio (código, docs, scripts, plataforma, convex, css, tests) sin `node_modules` ni `.git` |
| `media-manifest.csv` (~64 KB) | 410 rutas de `media/` con tamaño y hash SHA-256 de verificación |

---

## 2. Cómo volver a este estado si se requiere

- **Examinar la rama de respaldo:**
  ```bash
  git checkout backup/estable-2026-10-06
  ```
- **O descomprimir el archivo de seguridad:**
  `backups/estable-2026-10-06/orbe-codigo-estable-2026-10-06.zip`
