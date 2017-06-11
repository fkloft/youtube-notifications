interface Node extends EventTarget {
	appendChild<T extends Node>(newChild: T): T;
	insertBefore<T extends Node>(newChild: T, refChild?: Node): T;
}

interface Element {
	parentNode: Element;
}
interface HTMLElement {
	parentNode: HTMLElement;
}

