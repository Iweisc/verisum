const highlightParagraph = (
  id: string,
  attr: string = 'data-vectordb-id'
): void => {
  const attributeName = `${attr}-highlighted`;
  const highlighted = document.querySelectorAll(`[${attributeName}]`);
  highlighted.forEach((element) => {
    (element as HTMLElement).style.backgroundColor = '';
    (element as HTMLElement).style.transition = '';
    element.removeAttribute(attributeName);
  });
  const element: HTMLElement = document.querySelector(`[${attr}="${id}"]`);
  if (element) {
    const rect = element.getBoundingClientRect();
    const top = rect.top + window.scrollY - window.innerHeight / 2;
    window.scrollTo({
      top,
      behavior: 'smooth',
    });

    element.style.transition = 'background-color 0.3s ease-in-out';
    element.style.backgroundColor = '#ffeb3b';
    element.style.outline = '2px solid #fbc02d';
    element.style.outlineOffset = '2px';
    element.setAttribute(attributeName, 'true');

    setTimeout(() => {
      element.style.backgroundColor = '';
      element.style.outline = '';
      element.style.outlineOffset = '';
      setTimeout(() => {
        element.style.transition = '';
      }, 300);
    }, 3000);
  }
};

export default highlightParagraph;
