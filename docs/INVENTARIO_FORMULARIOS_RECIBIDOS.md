# Inventario inicial de formularios recibidos

Fecha de revisión: 2026-09-02. Los archivos originales permanecen en su ubicación de origen; todavía no se copian al repositorio ni al almacenamiento de producción.

## Criterio de uso

- **Plantilla candidata**: puede incorporarse tras verificar visualmente que está vacía y que su versión está vigente.
- **Referencia con datos**: contiene datos diligenciados o firmas; no debe cargarse como plantilla ni usarse en pruebas sin anonimización completa.
- **Pendiente**: requiere confirmar si la versión está vacía, vigente y autorizada.

| Archivo | Entidad o tipo identificado | Páginas | Formulario interactivo | Estado de uso |
| --- | --- | ---: | --- | --- |
| `ACI-422809.pdf` | Afiliación / novedades SGSSS | 2 | No | Pendiente de validar versión y estado vacío |
| `791016204.pdf` | EPS Sanitas, afiliación / novedades | 3 | No | Pendiente de validar versión y estado vacío |
| `4017221203.pdf` | Afiliación / novedades SGSSS | 5 | No | Pendiente de validar versión y estado vacío |
| `Formulario Inclusion beneficiarios.pdf` | Inclusión de beneficiarios, EPS Sanitas | 6 | No | Referencia con datos; requiere versión vacía |
| `01_Formulario_Famisanar_EPS.pdf` | Famisanar, afiliación / novedades SGSSS | 3 | No | Plantilla candidata |
| `02_Formulario_Sanitas_EPS.pdf` | EPS Sanitas, afiliación / novedades SGSSS | 4 | No | Plantilla candidata, validar versión |
| `03_Formulario_Coosalud_EPS.pdf` | Coosalud, afiliación / novedades SGSSS | 4 | No | Referencia con datos; requiere versión vacía |
| `04_Formulario_Capital_Salud_EPS.pdf` | Capital Salud, afiliación / novedades SGSSS | 6 | Sí, 331 campos | Plantilla candidata |
| `05_Formulario_Aliansalud_EPS.pdf` | Aliansalud, afiliación / novedades SGSSS | 2 | No | Plantilla candidata, validar versión |
| `06_Formulario_Unico_Nacional_SGSSS.pdf` | Formulario único nacional SGSSS | 6 | Sí, 331 campos | Plantilla candidata; posible misma versión que Capital Salud |
| `07_Formulario_Afiliacion_ARL_Sura.pdf` | ARL Sura, independientes voluntarios | 4 | No | Plantilla candidata; flujo distinto al de EPS dependiente |
| `08_Formulario_Comfenalco_Santander.pdf` | Comfenalco Santander, afiliación empleador | 2 | No | Referencia con datos y firma; requiere versión vacía |
| `09_Formulario_Comfanorte.pdf` | Comfanorte, afiliación empleador | 2 | No | Plantilla candidata, validar versión |

## Hallazgos técnicos

1. Capital Salud y el formulario único nacional tienen campos AcroForm interactivos. Se deben completar como formulario PDF y validar su árbol de campos antes de entregar cualquier PDF.
2. Los demás requieren mapeo por coordenadas: la aplicación dibuja texto o marcas sobre el PDF conservando el original.
3. Los trámites se dividen en tres familias: EPS/SGSSS, ARL y caja de compensación. Cada una necesita un asistente de datos y reglas documentales propios.
4. Antes de configurarlos se necesita confirmar la vigencia de cada PDF en la entidad respectiva. No se asume que una versión antigua siga siendo aceptada.
