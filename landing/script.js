const revealItems = document.querySelectorAll(".reveal, .reveal-on-scroll");

for (const item of revealItems) {
  if (item.classList.contains("reveal")) {
    item.classList.add("visible");
  }
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    }
  },
  {
    threshold: 0.18,
    rootMargin: "0px 0px -8% 0px",
  },
);

for (const item of document.querySelectorAll(".reveal-on-scroll")) {
  observer.observe(item);
}

const yearNode = document.getElementById("year");
if (yearNode) {
  yearNode.textContent = String(new Date().getFullYear());
}
