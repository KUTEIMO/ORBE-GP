# Requisitos de producto — Orbe360 / PEVCI

## RF — Funcionales

| ID | Requisito | Prioridad | Sprint | Estado |
|----|-----------|-----------|--------|--------|
| RF-01 | Visitante ve landing Orbe360 | Must | 2 | Hecho |
| RF-02 | Visitante abre demo Unisimón | Must | 2 | Hecho |
| RF-03 | Superadmin inicia sesión | Must | 1 | Hecho |
| RF-04 | Superadmin crea organizaciones | Must | 2 | Hecho |
| RF-05 | Superadmin crea usuarios admin (email/password) | Must | 2 | Hecho |
| RF-06 | Admin Unisimón edita hotspots en Control Web | Must | 3 | Hecho |
| RF-07 | Guardado Control Web sincroniza a Convex | Must | 3 | Hecho |
| RF-08 | Tour público usa misma data (Convex) en todos los navegadores | Must | 3 | Hecho |
| RF-09 | Engranaje del tour abre Control Web (o login si no hay sesión) | Must | 3 | Hecho |
| RF-10 | Enlace plataforma desde tour | Should | 3 | Hecho |
| RF-11 | Subida de panoramas desde admin | Must | 4 | Hecho |
| RF-12 | Onboarding guiado paso a paso en UI | Should | 4 | Parcial (hints en diálogo) |
| RF-13 | Multi-tour en misma org | Could | 5 | Schema listo |
| RF-14 | Multi-organización aislada | Could | 5 | Schema listo |

## RNF — No funcionales

| ID | Requisito | Prioridad | Estado |
|----|-----------|-----------|--------|
| RNF-01 | Accesibilidad WCAG básica en tour (teclado, contraste, SR) | Must | En tour actual |
| RNF-02 | Rutas HTTP resolubles (sin 404 en links internos) | Must | En auditoría |
| RNF-03 | Auth: roles no pueden escalar privilegios | Must | Probado QA |
| RNF-04 | No exponer passwords demo en UI por defecto | Must | Hecho (?demo=1) |
| RNF-05 | Hash de password (mejorar a argon2/bcrypt en prod) | Should | SHA-256+salt MVP |
| RNF-06 | Documentación de sprints / hallazgos | Must | docs/producto |
| RNF-07 | Curso PM: discurso piloto Unisimón sin scope creep | Must | Checklist curso |
| RNF-08 | Rate-limit login (anti fuerza bruta) | Must | Hecho (8/15min) |

## Fuera de alcance (curso)
Marketplace global, LSC/Braille Must, investigación ODS como núcleo del parcial.
