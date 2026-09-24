/* ==========================================================
   La Casa del Blunt — pedido por WhatsApp y verificación de edad
   ========================================================== */

(() => {
  "use strict";

  // Número de WhatsApp de la tienda: código de país + número, sin "+" ni espacios.
  // Si lo cambias, cámbialo también en los enlaces "wa.me" de index.html.
  const WHATSAPP = "573016631593";
  const TIENDA = "La Casa del Blunt";

  const CLAVE_EDAD = "lcdb-mayor-de-edad";
  const CLAVE_PEDIDO = "lcdb-pedido";

  const $ = (selector, raiz = document) => raiz.querySelector(selector);
  const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

  const pesos = (valor) => "$" + valor.toLocaleString("es-CO");

  // El navegador puede bloquear el almacenamiento (modo privado, etc.).
  // En ese caso la página sigue funcionando; solo no recuerda nada entre visitas.
  function leer(clave, porDefecto) {
    try {
      return JSON.parse(localStorage.getItem(clave)) ?? porDefecto;
    } catch {
      return porDefecto;
    }
  }
  function guardar(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      /* sin almacenamiento disponible */
    }
  }

  /* ================= VERIFICACIÓN DE EDAD ================= */
  const edad = $("#edad");

  if (typeof edad.showModal === "function" && !leer(CLAVE_EDAD, false)) {
    edad.showModal();
  }
  edad.addEventListener("cancel", (evento) => evento.preventDefault());
  $("#edad-si").addEventListener("click", () => {
    guardar(CLAVE_EDAD, true);
    edad.close();
  });
  $("#edad-no").addEventListener("click", () => edad.classList.add("rechazado"));

  /* ================= CATÁLOGO ================= */
  // Se lee de las tarjetas de index.html: allí se editan nombres y precios.
  const productos = new Map(
    $$(".producto").map((tarjeta) => [
      tarjeta.dataset.id,
      {
        nombre: $("h3", tarjeta).textContent.trim(),
        precio: Number(tarjeta.dataset.precio),
      },
    ])
  );

  /* ================= PEDIDO ================= */
  // { idProducto: cantidad }. Se descartan productos que ya no existen en la página.
  let pedido = Object.fromEntries(
    Object.entries(leer(CLAVE_PEDIDO, {})).filter(
      ([id, cantidad]) => productos.has(id) && Number.isInteger(cantidad) && cantidad > 0
    )
  );

  const carrito = $("#carrito");
  const lista = $("#carrito-lista");
  const vacio = $("#carrito-vacio");
  const total = $("#carrito-total");
  const enviar = $("#carrito-enviar");
  const vaciar = $("#carrito-vaciar");
  const plantilla = $("#plantilla-linea");
  const contadores = $$("[data-contador]");

  function cambiar(id, diferencia) {
    const cantidad = (pedido[id] || 0) + diferencia;
    if (cantidad > 0) {
      pedido[id] = Math.min(cantidad, 99);
    } else {
      delete pedido[id];
    }
    guardar(CLAVE_PEDIDO, pedido);
    pintar();
  }

  function enlaceWhatsApp(lineas, suma) {
    const detalle = lineas
      .map((l) => `• ${l.cantidad} × ${l.nombre} — ${pesos(l.cantidad * l.precio)}`)
      .join("\n");
    const texto =
      `Hola, quiero hacer este pedido en ${TIENDA}:\n\n${detalle}\n\n` +
      `Total: ${pesos(suma)}\n\nMi nombre es: \nBarrio o dirección: `;
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
  }

  function crearLinea({ id, nombre, precio, cantidad }) {
    const linea = plantilla.content.firstElementChild.cloneNode(true);
    linea.dataset.id = id;
    $(".linea-nombre", linea).textContent = nombre;
    $(".linea-precio", linea).textContent = `${pesos(precio)} c/u`;
    $(".linea-subtotal", linea).textContent = pesos(precio * cantidad);
    $(".cantidad-valor", linea).textContent = cantidad;
    $("[data-accion='menos']", linea).setAttribute("aria-label", `Quitar uno de ${nombre}`);
    $("[data-accion='mas']", linea).setAttribute("aria-label", `Agregar uno más de ${nombre}`);
    return linea;
  }

  function pintar() {
    const lineas = Object.entries(pedido).map(([id, cantidad]) => ({
      id,
      cantidad,
      ...productos.get(id),
    }));
    const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
    const suma = lineas.reduce((s, l) => s + l.cantidad * l.precio, 0);

    contadores.forEach((contador) => {
      contador.textContent = unidades;
      contador.hidden = unidades === 0;
    });

    // Al redibujar la lista se conserva el foco en el botón +/− que se usó.
    const enfocado = document.activeElement?.closest(".linea [data-accion]");
    const foco = enfocado && {
      id: enfocado.closest(".linea").dataset.id,
      accion: enfocado.dataset.accion,
    };

    lista.replaceChildren(...lineas.map(crearLinea));
    vacio.hidden = lineas.length > 0;
    vaciar.hidden = lineas.length === 0;
    total.textContent = pesos(suma);

    if (lineas.length) {
      enviar.href = enlaceWhatsApp(lineas, suma);
      enviar.removeAttribute("aria-disabled");
    } else {
      enviar.removeAttribute("href");
      enviar.setAttribute("aria-disabled", "true");
    }

    if (foco) {
      const linea = $$(".linea", lista).find((el) => el.dataset.id === foco.id);
      (linea ? $(`[data-accion='${foco.accion}']`, linea) : $("#carrito-cerrar")).focus();
    }
  }

  /* ================= AVISO ================= */
  const aviso = $("#aviso");
  let avisoTiempo;

  function avisar(texto) {
    aviso.textContent = texto;
    aviso.classList.add("visible");
    clearTimeout(avisoTiempo);
    avisoTiempo = setTimeout(() => aviso.classList.remove("visible"), 2200);
  }

  function saltarContador() {
    contadores.forEach((contador) => {
      contador.classList.remove("salta");
      void contador.offsetWidth; // reinicia la animación
      contador.classList.add("salta");
    });
  }

  /* ================= EVENTOS ================= */
  const tiemposBoton = new WeakMap();

  $$(".producto").forEach((tarjeta) => {
    const { id } = tarjeta.dataset;
    const { nombre } = productos.get(id);
    const boton = $(".boton-agregar", tarjeta);
    const etiqueta = $("span", boton);
    const icono = $("use", boton);

    boton.setAttribute("aria-label", `Agregar ${nombre} al pedido`);
    boton.addEventListener("click", () => {
      cambiar(id, 1);
      saltarContador();
      avisar(`Agregado: ${nombre}`);

      boton.classList.add("agregado");
      etiqueta.textContent = "Agregado";
      icono.setAttribute("href", "#i-check");
      clearTimeout(tiemposBoton.get(boton));
      tiemposBoton.set(
        boton,
        setTimeout(() => {
          boton.classList.remove("agregado");
          etiqueta.textContent = "Agregar";
          icono.setAttribute("href", "#i-mas");
        }, 1400)
      );
    });
  });

  lista.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-accion]");
    if (!boton) return;
    const { id } = boton.closest(".linea").dataset;
    cambiar(id, boton.dataset.accion === "mas" ? 1 : -1);
  });

  $$("[data-abrir-carrito]").forEach((boton) =>
    boton.addEventListener("click", () => carrito.showModal())
  );
  $("#carrito-cerrar").addEventListener("click", () => carrito.close());
  // Clic en el fondo oscuro cierra el panel.
  carrito.addEventListener("click", (evento) => {
    if (evento.target === carrito) carrito.close();
  });

  vaciar.addEventListener("click", () => {
    pedido = {};
    guardar(CLAVE_PEDIDO, pedido);
    pintar();
    $("#carrito-cerrar").focus();
  });

  pintar();
})();
