# Actores y casos de uso (UML / Mermaid)

## Actores

| Actor | Descripción |
|-------|-------------|
| Visitante | Ve landing y demos/tours publicados |
| Superadmin | Gestiona organizaciones y usuarios admin |
| Admin organización | Administra tours de su cliente (ej. Unisimón) |
| Editor de tour | Edita escenas/hotspots (puede ser el mismo admin) |

## Usuarios semilla

| Email | Rol | Propósito |
|-------|-----|-----------|
| `superadmin@orbe360.local` | Superadmin plataforma | Gestionar clientes y admins |
| `admin@unisimon.local` | Org admin Unisimón | Admin del tour 360 campus |

## Diagrama de casos de uso

```mermaid
flowchart LR
  Visitor[Visitante]
  Super[Superadmin]
  OrgAdmin[Admin_Unisimon]

  Visitor --> UC1[Ver_landing]
  Visitor --> UC2[Abrir_demo_Unisimon]
  Super --> UC3[CRUD_organizaciones]
  Super --> UC4[CRUD_usuarios_admin]
  Super --> UC5[Asignar_roles]
  OrgAdmin --> UC6[Editar_tour_360]
  OrgAdmin --> UC7[Subir_panoramas]
  OrgAdmin --> UC8[Gestionar_hotspots]
  OrgAdmin --> UC2
```

## Flujos prioritarios
1. Visitante → Landing → Demo Unisimón.
2. Superadmin → Login → Crear org → Crear admin → Asignar.
3. Admin Unisimón → Login → Control Web → Subir/editar → Publicar.
