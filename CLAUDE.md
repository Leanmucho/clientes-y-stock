# CLAUDE.md - Guía para el Repositorio `clientes-y-stock`

Este documento sirve como una guía de contexto para Claude Code, ayudándole a entender la estructura, tecnologías y convenciones del proyecto `clientes-y-stock` de manera eficiente. El objetivo es optimizar el uso de tokens y asegurar respuestas más precisas y relevantes.

## 1. Visión General del Proyecto

La aplicación `clientes-y-stock` es una herramienta móvil de gestión comercial diseñada para administrar clientes, inventario (stock), ventas, cobros (cuotas), gastos, proveedores, equipo, rutas y reportes. Está construida con un enfoque en la eficiencia y la usabilidad para negocios pequeños y medianos.

## 2. Stack Tecnológico

- **Frontend:** React Native (con Expo)
- **Lenguaje:** TypeScript
- **Base de Datos & Backend:** Supabase (PostgreSQL, Auth, RLS)
- **Estilos:** Tailwind CSS (a través de `nativewind` o similar, aunque se usan `StyleSheet.create` de React Native y `lib/colors.ts`)
- **Iconos:** `@expo/vector-icons`
- **Navegación:** `expo-router`

## 3. Estructura de Directorios Clave

- `/app`: Contiene las pantallas y la lógica de navegación de la aplicación.
  - `/app/(tabs)`: Pantallas principales accesibles a través de la barra de navegación inferior (ej. `stock.tsx`, `cobros.tsx`, `clients.tsx`).
  - `/app/client`, `/app/product`, `/app/sale`, `/app/expense`, `/app/supplier`: Directorios para pantallas de detalle o formularios relacionados con cada entidad.
- `/components`: Componentes UI reutilizables (ej. `Loading.tsx`, `DateInput.tsx`, `BottomSheet.tsx`).
- `/lib`: Utilidades, funciones de ayuda y configuración global (ej. `database.ts` para interacción con Supabase, `colors.ts` para la paleta de colores, `utils.ts` para funciones de formato).
- `/types`: Definiciones de interfaces TypeScript para los modelos de datos de la aplicación (`index.ts`).
- `/supabase`: Archivos de configuración o scripts relacionados con Supabase (`schema.sql`).

## 4. Módulos y Funcionalidades Principales

- **Clientes (`app/(tabs)/clients.tsx`, `app/client/*`):** Gestión de información de clientes, historial de compras y pagos.
- **Stock/Productos (`app/(tabs)/stock.tsx`, `app/product/*`):** Gestión de inventario, categorías, control de stock mínimo, importación por CSV.
- **Ventas (`app/sale/*`):** Registro de ventas al contado o a crédito con frecuencia mensual/quincenal/semanal.
- **Cobros/Cuotas (`app/(tabs)/cobros.tsx`):** Seguimiento y registro de pagos de cuotas, gestión de deudas.
- **Gastos (`app/(tabs)/gastos.tsx`, `app/expense/*`):** Registro y categorización de gastos operativos.
- **Proveedores (`app/(tabs)/proveedores.tsx`, `app/supplier/*`):** Gestión de información de proveedores.
- **Equipo (`app/(tabs)/equipo.tsx`):** Gestión de usuarios de la aplicación (vendedores, cobradores).
- **Rutas (`app/(tabs)/rutas.tsx`):** Organización de clientes por rutas para visitas o cobros.
- **Reportes (`app/(tabs)/reportes.tsx`):** Exportación CSV de ventas, deudores e inventario.
- **Dashboard (`app/(tabs)/index.tsx`):** Estadísticas, productos con poco stock, cuotas pendientes.

## 5. Modelos de Datos (Interfaces TypeScript en `types/index.ts`)

- `Category`: `id`, `name`, `description?`, `created_at`.
- `Client`: `id`, `name`, `dni`, `phone`, `address`, `reference`, `zone`, `created_at`.
- `Product`: `id`, `name`, `description`, `price`, `stock`, `min_stock`, `image_url`, `category_id?`, `category_name?`, `created_at`.
- `Sale`: `id`, `client_id`, `client_name?`, `product_name?`, `total_amount`, `paid_amount`, `status`, `notes`, `installment_frequency` (`weekly`|`biweekly`|`monthly`), `created_at`, `items?: SaleItem[]`.
- `SaleItem`: `id`, `sale_id`, `product_id`, `product_name`, `quantity`, `unit_price`.
- `Installment`: `id`, `sale_id`, `installment_number`, `due_date`, `expected_amount`, `paid_amount`, `status` (`pending`|`partial`|`paid`|`overdue`), `notes`, `created_at`.
- `Expense`: `id`, `category`, `description`, `amount`, `date`, `supplier_id?`, `supplier_name?`, `payment_method`, `notes`, `created_at`.
- `Supplier`: `id`, `name`, `contact_name`, `phone`, `email`, `address`, `category`, `notes`, `created_at`.
- `TeamMember`: `id`, `name`, `role`, `phone`, `commission_rate`, `active`, `created_at`.

## 6. Funciones Clave en `lib/database.ts`

- `getProducts()`, `getProduct(id)`, `createProduct()`, `updateProduct()`, `deleteProduct()`
- `getCategories()`, `createCategory(name, description)`, `deleteCategory(id)`
- `getClients()`, `getClient(id)`, `createClient()`, `updateClient()`, `deleteClient()`
- `getSales()`, `createSale()`, `registerPayment(installmentId, amount)`
- `getInstallments(filters)`, `markOverdueInstallments()`
- `getDashboardStats()`, `getLowStockProducts()`
- `getSalesExport()`, `getDebtorsExport()`, `getInventoryExport()` — devuelven arrays listos para CSV
- `bulkUpdateStockByName(rows: {name, stock}[])` — importación masiva de stock por nombre
- `getExpenses()`, `createExpense()`, `updateExpense()`, `deleteExpense()`
- `getSuppliers()`, `createSupplier()`, `updateSupplier()`, `deleteSupplier()`

## 7. Funciones Clave en `lib/utils.ts`

- `formatCurrency(amount)` — formato monetario local
- `formatDate(date)` — formato de fecha legible
- `generateInstallmentDates(startDate, count, paymentDay)` — fechas mensuales
- `generateWeeklyInstallmentDates(startDate, count)` — fechas cada 7 días
- `generateBiweeklyInstallmentDates(startDate, count)` — fechas cada 14 días
- `downloadFile(filename, content, mimeType)` — descarga CSV (web: blob URL, nativo: FileSystem + Sharing)
- `toCSV(rows, headers)` — convierte array de objetos a string CSV

## 8. Componentes Reutilizables

- `components/BottomSheet.tsx` — modal draggable hacia abajo con PanResponder solo en el handle
- `components/Loading.tsx` — indicador de carga
- `components/DateInput.tsx` — input de fecha formateado

## 9. Supabase / Base de Datos

- Todas las tablas tienen `user_id UUID` con trigger `set_user_id()` en INSERT
- RLS habilitado con `FORCE ROW LEVEL SECURITY` en todas las tablas
- Policy patrón: `auth.uid() = user_id`
- Tablas: `categories`, `products`, `clients`, `sales`, `sale_items`, `installments`, `expenses`, `suppliers`, `team_members`, `routes`
- `products.category_id` → FK a `categories(id) ON DELETE SET NULL`
- `sales.installment_frequency` → CHECK (`weekly`, `biweekly`, `monthly`)

## 10. Convenciones y Buenas Prácticas

- **TypeScript:** Tipado estricto, interfaces en `types/index.ts` para todos los modelos.
- **UI/UX:** Paleta de colores en `lib/colors.ts`, iconos de `@expo/vector-icons`.
- **Estado:** `useState`, `useCallback`, `useFocusEffect` para carga de datos al enfocar pantalla.
- **Bottom sheets:** Usar `components/BottomSheet.tsx` en lugar de `Modal` para cualquier panel desplegable.
- **Caché:** `cacheGet`/`cacheSet` con TTL para productos y clientes (evitar refetch innecesario).
- **No duplicar código:** Si una función de DB ya existe en `database.ts`, usarla directamente.

## 11. Instrucciones para Claude Code

1. **Lee este archivo primero** antes de explorar el repositorio.
2. **No leas archivos completos innecesariamente** — usa Grep/Glob para localizar secciones específicas.
3. **Proporciona solo el código relevante** — no reescribas archivos completos salvo que se solicite.
4. **Pregunta si falta contexto** — no asumas estructuras de datos no documentadas aquí.
5. **Respeta el stack:** React Native, TypeScript, Supabase, `expo-router`, `lib/colors.ts`, `@expo/vector-icons`.
6. **Para tareas complejas, propón un plan primero.**
