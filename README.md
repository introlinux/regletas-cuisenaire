# Regletas de Cuisenaire virtuales

Aplicación web progresiva (PWA) para manipular **regletas de Cuisenaire** en el aula: en pizarras digitales, tablets y ordenadores. Funciona **sin conexión** después de la primera visita, se puede instalar como una aplicación más y no depende de ninguna librería externa.

Pensada para que los niños la usen con el dedo: todos los controles están en una barra inferior a su alcance y no hace falta el clic derecho del ratón para nada.

**▶ Usarla ahora:** <https://introlinux.github.io/regletas-cuisenaire/>

---

## Índice

- [Características](#características)
  - [Regletas](#regletas)
  - [Sacar regletas](#sacar-regletas)
  - [Seleccionar, mover y organizar](#seleccionar-mover-y-organizar)
  - [Menú de cada regleta](#menú-de-cada-regleta)
  - [Etiquetas](#etiquetas)
  - [Colores personalizables](#colores-personalizables)
  - [Giro libre para geometría](#giro-libre-para-geometría)
  - [Lienzo y visualización](#lienzo-y-visualización)
  - [Modo dibujo (pizarra)](#modo-dibujo-pizarra)
  - [Accesibilidad e idiomas](#accesibilidad-e-idiomas)
  - [Funcionamiento sin conexión](#funcionamiento-sin-conexión)
- [Cómo se usa](#cómo-se-usa)
- [Atajos de teclado](#atajos-de-teclado)
- [Puesta en marcha](#puesta-en-marcha)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Detalles técnicos](#detalles-técnicos)
- [Licencia](#licencia)

---

## Características

### Regletas

- **Las 10 regletas estándar** con los colores de Cuisenaire:

  | Valor | Color | Valor | Color |
  |---|---|---|---|
  | 1 | gris claro (blanca) | 6 | verde oscuro |
  | 2 | rojo | 7 | gris oscuro (negra) |
  | 3 | verde claro | 8 | marrón |
  | 4 | rosa | 9 | azul |
  | 5 | amarillo | 10 | naranja |

- **Regleta especial redimensionable**: se estira o encoge desde su extremo (las flechas ◀▶ aparecen al pasar el ratón o al seleccionarla, para evitar cambios de tamaño accidentales).
  - Adopta automáticamente el color de la regleta estándar de su misma longitud (con 5 unidades es amarilla) y solo es **fucsia si mide más de 10**.
- **Placa de 100** (10 × 10) con el color de la regleta 10, útil por ejemplo para trabajar el euro.
- **Paleta lateral compacta** y plegable: la regleta 1 es cuadrada y cada una crece un poco, para ver el orden sin ocupar mucho ancho. La paleta nunca tapa el lienzo.

### Sacar regletas

- **Arrastrar** desde la paleta hasta el lienzo.
- **Pulsar** en la paleta para añadirla sin arrastrar:
  - Pulsar varias veces la **misma** regleta las coloca **una a continuación de otra** (3 pulsaciones en la 4 → 4 + 4 + 4).
  - Pulsar regletas **distintas** las coloca en filas sucesivas: pulsando 1, 2, 3… 10 se forma la escalera.
- **Devolver** una regleta del lienzo a la paleta la elimina (aparece el aviso «Suelta aquí para eliminar»).

### Seleccionar, mover y organizar

- **Dos modos** en la barra inferior (por defecto, *Seleccionar*):
  - **Seleccionar**: tocar una regleta la selecciona; arrastrar sobre el fondo dibuja un **recuadro de selección** para elegir varias; arrastrar una regleta seleccionada mueve todo el grupo.
  - **Mover lienzo**: arrastrar desplaza la vista (aunque se empiece encima de una regleta), así nadie mueve piezas sin querer.
- **Pellizcar con dos dedos** hace zoom y desplaza la vista en cualquier modo.
- **Ajuste magnético**: con la cuadrícula visible, las regletas encajan en ella; además se pegan borde con borde con las regletas cercanas. Se puede desactivar en *Ajustes*.
- La regleta seleccionada se resalta con un **borde azul grueso** con halo blanco, visible incluso entre regletas pegadas.
- **Unir / Separar**: varias regletas se pueden unir en un **bloque** que se selecciona, mueve, duplica, gira y elimina como una sola pieza (se marca con un recuadro discontinuo).
- **Deshacer / Rehacer** ilimitado para todas las acciones.

### Menú de cada regleta

Se abre **tocando una regleta que ya está seleccionada**, con clic derecho o con una pulsación larga. Actúa sobre toda la selección:

- **Activar/Desactivar relleno** (regleta sólida o solo contorno).
- **Numerar cuadritos / Quitar numeración**: escribe 1, 2, 3… en cada cuadrito unitario (en la placa de 100, del 1 al 100 por filas, como una tabla del 100). Útil para poner regletas encima y ver de un vistazo hasta dónde hay que llegar.
  Con varias regletas seleccionadas se numeran **como un único bloque**: cada una continúa donde acaba la anterior (por filas, de izquierda a derecha; por columnas si todas están en vertical). Por ejemplo, una regleta de 10 con una de 3 al lado queda numerada del 1 al 13.
  En *Ajustes → Numerar desde abajo* la numeración empieza abajo a la izquierda: la placa de 100 queda con el 1 en la esquina inferior izquierda, las regletas verticales se cuentan de abajo arriba y los bloques empiezan por la fila (o la columna) de abajo. Al cambiar este ajuste, los bloques ya numerados se renumeran solos.
- **Girar** 90°.
- **Unir / Separar** (con dos o más regletas).
- **Duplicar**.
- **Bloquear / Desbloquear** (una regleta bloqueada no se mueve ni se borra por accidente).
- **Eliminar**.

### Etiquetas

Selector de etiquetas en la barra inferior:

- **Básico**: regletas lisas.
- **Números enteros**: 1, 2, 3…
- **Decimales**: valor respecto a la unidad elegida (por defecto, la naranja vale 1 → 0,1; 0,2…).
- **Letras**: inicial de cada color. Si dos colores empiezan igual, la pequeña va en minúscula y la grande en mayúscula: `b r v R a V n m A N`, `f` para la especial fucsia y `P` para la placa.
- **Fracciones**: valor fraccionario simplificado respecto a la unidad elegida.

En *Decimales* y *Fracciones* se elige **qué regleta vale 1**: cualquiera de la 1 a la 10 o la **placa de 100** (con la placa como unidad: blanca = 1/100 = 0,01, amarilla = 1/20 = 0,05, naranja = 1/10 = 0,1…).

Las etiquetas también se muestran en la paleta y siempre se mantienen derechas, aunque la regleta esté girada.

**Etiquetado de solo algunas regletas:** si hay regletas seleccionadas, el selector de etiquetas cambia únicamente esas; sin selección, cambia el etiquetado general. Así se pueden mezclar, por ejemplo, `a = v + r` junto a `5 = 3 + 2`, o `5 = 3 + r`. La opción *Etiquetado general* devuelve las regletas seleccionadas al etiquetado de las demás.

### Colores personalizables

En **Ajustes → Colores de las regletas**:

- Dos juegos de colores listos: **Cuisenaire** y **María Antonia Canals** (madera natural, rosa, azul, rojo, verde, lila, amarillo, marrón, azul oscuro y marrón oscuro).
- **Color de cada regleta a elección**, incluidas la especial y la placa de 100 (color canela clarito por defecto). El borde y el color del texto se calculan solos para que se lean bien.
- Botón para restaurar los colores del juego elegido.

### Giro libre para geometría

Para construir polígonos. Se activa con el botón **Giro libre** de la barra inferior (desactivado por defecto para no molestar en el día a día):

- Al seleccionar una regleta (o un bloque) aparece un **asa de giro** en su extremo derecho.
- La regleta gira **de 3 en 3 grados** sobre su **vértice inferior izquierdo** (marcado con un punto), así que se puede «levantar» sin despegarla de la regleta sobre la que está apoyada.
- Mientras se gira aparece una **cartela con el ángulo**, medido en sentido antihorario, como en geometría.
- **Duplicar** una regleta girada coloca la copia **a continuación** del original, con el mismo ángulo y lista para seguir girando: duplicar → levantar → duplicar → levantar… y el polígono queda hecho.
- Las regletas giradas se **unen vértice con vértice** al acercarlas.
- Los giros rectos (90°, 180°, 270°) siguen encajando en la cuadrícula.

### Lienzo y visualización

- **Lienzo infinito** con desplazamiento y zoom (botones, rueda del ratón, pellizco).
- **Ajustar a pantalla** para ver todo el trabajo de un vistazo y **pantalla completa**.
- **Cuadrícula** conmutable.
- **Líneas unitarias**: marcas de cada unidad dentro de las regletas (y la cuadrícula de 100 en la placa).
- **Orientación** horizontal / vertical: gira toda la composición de una vez conservando la colocación entre regletas.
- **Restaurar** limpia el lienzo (se puede deshacer).

### Modo dibujo (pizarra)

- **Lápiz** y **subrayador** semitransparente, en tres grosores y 11 colores.
- **Goma** que borra trazos sin tocar las regletas.
- **Borrar todo** (solo los dibujos) y **Salir** para volver a manipular regletas.

### Accesibilidad e idiomas

- Interfaz en **español, inglés y francés**.
- **Modo de alto contraste** (bordes negros gruesos, etiquetas en negrita).
- Botones grandes, pensados para pizarras digitales y para el dedo.
- La barra inferior se adapta al ancho de la pantalla (oculta textos o se reparte en dos filas en tablets en vertical).

### Funcionamiento sin conexión

- **PWA instalable** (Chrome, Edge, Safari, Firefox): funciona sin internet tras la primera carga gracias a un *Service Worker*.
- El trabajo, los colores y las preferencias **se guardan automáticamente** en el navegador.

---

## Cómo se usa

| Quiero… | Cómo |
|---|---|
| Añadir una regleta | Arrastrarla desde la paleta o pulsarla |
| Mover una regleta | Arrastrarla (modo *Seleccionar*) |
| Seleccionar varias | Arrastrar sobre el fondo para dibujar un recuadro |
| Abrir el menú de una regleta | Tocar una regleta ya seleccionada (o clic derecho / pulsación larga) |
| Unir varias en un bloque | Seleccionarlas → menú → *Unir* |
| Desplazar la vista | Modo *Mover lienzo*, dos dedos o botón central del ratón |
| Hacer zoom | Pellizcar, rueda del ratón o botones − / + |
| Eliminar una regleta | Menú → papelera, o devolverla a la paleta |
| Girar libremente | Activar *Giro libre* y arrastrar el asa |
| Estirar la regleta especial | Seleccionarla y arrastrar las flechas de su extremo |

---

## Atajos de teclado

| Tecla | Acción |
|---|---|
| `Ctrl` + `Z` | Deshacer |
| `Ctrl` + `Y` / `Ctrl` + `Mayús` + `Z` | Rehacer |
| `Ctrl` + `A` | Seleccionar todas las regletas |
| `Mayús` + clic | Añadir o quitar de la selección |
| `Supr` / `Retroceso` | Eliminar la selección |
| `R` | Girar 90° |
| `D` | Duplicar |
| `N` | Numerar cuadritos / quitar numeración |
| `[` / `]` | Girar 3° (con *Giro libre* activado) |
| Flechas | Mover la selección |
| `+` / `-` | Zoom |
| `Esc` | Cerrar menús, salir del modo dibujo o quitar la selección |

---

## Puesta en marcha

No hay que compilar nada ni instalar dependencias: basta con servir la carpeta con cualquier servidor web estático.

```bash
# Con Python
python -m http.server 8000

# o con Node.js
npx serve .
```

Y abrir `http://localhost:8000` en el navegador.

> Abrir `index.html` con doble clic también funciona, pero entonces no hay modo sin conexión ni instalación como app: el Service Worker solo funciona servido por `http://localhost` o `https://`.

### Publicarla en internet

Al ser una web estática, se puede publicar gratis con **GitHub Pages**, Netlify o cualquier alojamiento estático. Una vez publicada, cada maestro puede abrirla y pulsar *Ajustes → Instalar aplicación* (o la opción de instalar del navegador) para tenerla disponible sin conexión.

### Publicar cambios

Cuando se modifique algún archivo, hay que **subir la versión de la caché** en `sw.js` (por ejemplo, de `regletas-v13` a `regletas-v14`) para que los dispositivos que ya tienen la app instalada descarguen la versión nueva.

---

## Estructura del proyecto

```
├── index.html              Página principal: barra inferior, paleta, lienzo, menús e iconos
├── manifest.webmanifest    Manifiesto de la PWA
├── sw.js                   Service Worker (caché para funcionar sin conexión)
├── css/
│   └── app.css             Estilos (incluye el modo de alto contraste)
├── js/
│   ├── app.js              Lógica de la aplicación
│   └── i18n.js             Textos en español, inglés y francés
└── icons/                  Iconos de la aplicación
```

---

## Detalles técnicos

- **HTML, CSS y JavaScript sin dependencias** ni paso de compilación; el lienzo se dibuja con **SVG**.
- **Pointer Events** para ratón, táctil y lápiz con el mismo código.
- Los datos se guardan en `localStorage` del navegador; no se envía nada a ningún servidor.
- Los colores del juego de María Antonia Canals se han tomado de la ficha del material comercial (ArDidac); pueden ajustarse desde el propio menú de colores si no coinciden exactamente con los de una caja concreta.

---

## Licencia

Publicado bajo la [licencia MIT](LICENSE).
