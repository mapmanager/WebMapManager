import introJs from "intro.js";
import { IntroStep } from "intro.js/src/core/steps";

export const openHelpMenu = async () => {
  const blocker = document.createElement("div");
  blocker.className = "fixed top-0 left-0 w-full h-full z-[100000] bg-black/50 cursor-pointer text-white text-2xl flex items-center justify-center";
  blocker.textContent = "Click on the item you need help with";
  document.body.appendChild(blocker);

  const borderBox = document.createElement("div");
  borderBox.className = "fixed pointer-events-none border-2 border-yellow-300 rounded-md block";
  blocker.appendChild(borderBox);

  const potentialTargets = document.createElement("div");
  potentialTargets.className = "fixed top-0 left-0 w-full h-full pointer-events-none opacity-50";
  blocker.appendChild(potentialTargets);

  document.body.querySelectorAll("[data-intro]").forEach((element) => {
    const bounds = element.getBoundingClientRect();
    const borderBoxTarget = document.createElement("div");
    borderBoxTarget.className = "fixed border border-yellow-300 rounded";
    borderBoxTarget.style.left = bounds.left + "px";
    borderBoxTarget.style.top = bounds.top + "px";
    borderBoxTarget.style.width = bounds.width + "px";
    borderBoxTarget.style.height = bounds.height + "px";
    potentialTargets.appendChild(borderBoxTarget);
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeBlocker();
    }
  };

  document.addEventListener("keydown", onKeyDown);

  const closeBlocker = () => {
    document.body.removeChild(blocker);
    document.removeEventListener("keydown", onKeyDown);
  };

  const getElementAtPosition = (event: MouseEvent) => {
    const x = event.clientX;
    const y = event.clientY;
    const elementAtPosition = document.elementsFromPoint(x, y) as any;
    let element = elementAtPosition.find((el: any) => !blocker.contains(el));
    const steps: Partial<IntroStep>[] = [];

    while (element) {
      const addIntroStep = (el: HTMLElement) => {
        const intro = el.getAttribute("data-intro");
        if (!intro) return;
        const step = steps.length + 1;
        steps.push({ step, intro, element: el });
      };

      addIntroStep(element);
      element.querySelectorAll("[data-intro]").forEach(addIntroStep);

      if (steps.length !== 0) break;
      element = element.parentElement;
    }

    return {
      element,
      steps,
    };
  };

  const hideBorderBox = () => {
    borderBox.style.display = "none";
  };

  blocker.onmouseout = hideBorderBox;

  let elementSteps: ReturnType<typeof getElementAtPosition> | null = null;
  blocker.onmousemove = (event) => {
    elementSteps = getElementAtPosition(event);
    if (!elementSteps || !elementSteps.element.getAttribute("data-intro"))
      return hideBorderBox();
    borderBox.style.display = "block";
    const bounds = elementSteps.element.getBoundingClientRect();
    borderBox.style.left = bounds.left + "px";
    borderBox.style.top = bounds.top + "px";
    borderBox.style.width = bounds.width + "px";
    borderBox.style.height = bounds.height + "px";
  };

  blocker.onclick = (event) => {
    const { steps } = elementSteps ?? getElementAtPosition(event);
    closeBlocker();

    steps.push({
      step: 100000,
      title: "Manual",
      intro:
        "Please refer to the <a href='https://mapmanager.github.io/MapManager-Docs/' target='_blank'>manual</a> for additional help",
    });

    introJs()
      .setOptions({
        disableInteraction: true,
        steps,
      })
      .start();
  };
};
