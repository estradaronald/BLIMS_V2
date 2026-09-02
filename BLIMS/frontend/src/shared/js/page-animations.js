(function () {

  function setStaggerDelays(container) {
    const items = container.querySelectorAll(".reveal-item, .reveal-soft, .reveal-scale");

    items.forEach((item, index) => {
      item.style.setProperty("--delay", `${index * 45}ms`);
    });
  }

  function activatePageAnimations() {
    const pages = document.querySelectorAll(".page-animate");

    pages.forEach((page) => {
      setStaggerDelays(page);

      requestAnimationFrame(() => {
        page.classList.add("is-visible");
      });
    });

    // Tell other scripts that the page entrance animation has already settled
    setTimeout(() => {
    window.dispatchEvent(new CustomEvent("pageAnimationsReady"));
    }, 430);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", activatePageAnimations);
  } else {
    activatePageAnimations();
  }

})();