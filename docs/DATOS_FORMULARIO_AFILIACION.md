# Datos base · Solicitud de afiliación EPS

Este catálogo se deriva de las seis pantallas de referencia. Los campos con asterisco son obligatorios en el flujo visual y deben validarse antes de generar o radicar un formulario.

## 1. Persona

`tipoDocumento`, `numeroDocumento`, `primerNombre`, `segundoNombre`, `primerApellido`, `segundoApellido`, `sexo`, `identidadGenero`, `fechaNacimiento`.

Obligatorios: tipo y número de documento, primer nombre, primer apellido, sexo, identidad de género y fecha de nacimiento.

## 2. Entidad, residencia y EPS

`entidadSalud`, `paisNacimiento`, `departamentoNacimiento`, `ciudadNacimiento`, `paisExpedicion`, `departamentoExpedicion`, `ciudadExpedicion`, `fechaExpedicion`, `departamentoResidencia`, `ciudadResidencia`, `direccion`, `barrio`, `tipoResidencia`, `celular`, `correoElectronico`.

Regla: si el documento fue expedido fuera de Colombia, no se solicitan departamento ni ciudad de expedición. La lista de IPS depende de la entidad de salud y ciudad de residencia.

## 3. Datos laborales y afiliación

`tipoAfiliacion`, `tipoCotizante`, `solicitudSAT`, `arl`, `fondoPensiones`, `salario`, `cargo`, `fechaIngreso`.

Regla: `solicitudSAT` solo aplica a traslado. Para novedades no se incluyen beneficiarios.

## 4. Empresa

`tipoDocumentoEmpresa`, `numeroDocumentoEmpresa`, `razonSocial`, `departamentoEmpresa`, `ciudadEmpresa`, `direccionEmpresa`, `telefonoEmpresa`, `correoEmpresa`, `contactoRRHH`.

## 5. Beneficiarios

Solo para afiliaciones que correspondan. Cada beneficiario requiere parentesco, identificación, nombres, apellidos y fecha de nacimiento; los requisitos documentales dependen del parentesco.

## 6. Documentos y firmas

Documento del cotizante (máximo 2 MB por hoja), soportes adicionales (varias hojas, máximo 7 MB cada una), firma del empleado y firma de la empresa. Las firmas deben almacenarse como evidencia separada y nunca insertarse en un PDF sin aprobación humana.

## Datos que aún debemos confirmar con formularios oficiales

Listas válidas de EPS/IPS/ARL/AFP, códigos territoriales, opciones exactas de cotizante y afiliación, documentos obligatorios por trámite, límites finales de archivos, campos condicionales, reglas por entidad y el mecanismo de radicación de cada EPS.
