// Fork of hyperapp which removes most of its state management-related
// functionalities, we don't really need that here.

var SSR_NODE = 1;
var TEXT_NODE = 3;
var EMPTY_OBJ = {};
var EMPTY_ARR = [];
var SVG_NS = 'http://www.w3.org/2000/svg';

var map = EMPTY_ARR.map;
var isArray = Array.isArray;

var getKey = (vdom) => (vdom == null ? vdom : vdom.key);

var patchProperty = (node, key, oldValue, newValue, isSvg) => {
	if (key === 'style') {
		for (var k in { ...oldValue, ...newValue }) {
			oldValue = newValue == null || newValue[k] == null ? '' : newValue[k];
			if (k[0] === '-') {
				node[key].setProperty(k, oldValue);
			} else {
				node[key][k] = oldValue;
			}
		}
	} else if (key[0] === 'o' && key[1] === 'n') {
		key = key.slice(2);

		if (typeof oldValue === 'function') {
			node.removeEventListener(key, oldValue);
		}

		if (typeof newValue === 'function') {
			node.addEventListener(key, newValue);
		}
	} else if (!isSvg && key !== 'list' && key !== 'form' && key in node) {
		node[key] = newValue == null ? '' : newValue;
	} else if (newValue == null || newValue === false) {
		node.removeAttribute(key);
	} else {
		node.setAttribute(key, newValue);
	}
};

var createNode = (vdom, isSvg) => {
	var props = vdom.props;
	var node =
		vdom.type === TEXT_NODE
			? document.createTextNode(vdom.tag)
			: (isSvg = isSvg || vdom.tag === 'svg')
				? document.createElementNS(SVG_NS, vdom.tag, props.is && props)
				: document.createElement(vdom.tag, props.is && props);

	for (var k in props) {
		patchProperty(node, k, null, props[k], isSvg);
	}

	for (var i = 0; i < vdom.children.length; i++) {
		node.appendChild(createNode((vdom.children[i] = maybeVNode(vdom.children[i])), isSvg));
	}

	return (vdom.node = node);
};

var patch = (parent, node, oldVNode, newVNode, isSvg) => {
	if (oldVNode === newVNode) {
	} else if (oldVNode != null && oldVNode.type === TEXT_NODE && newVNode.type === TEXT_NODE) {
		if (oldVNode.tag !== newVNode.tag) node.nodeValue = newVNode.tag;
	} else if (oldVNode == null || oldVNode.tag !== newVNode.tag) {
		node = parent.insertBefore(createNode((newVNode = maybeVNode(newVNode)), isSvg), node);
		if (oldVNode != null) {
			parent.removeChild(oldVNode.node);
		}
	} else {
		var tmpVKid;
		var oldVKid;

		var oldKey;
		var newKey;

		var oldProps = oldVNode.props;
		var newProps = newVNode.props;

		var oldVKids = oldVNode.children;
		var newVKids = newVNode.children;

		var oldHead = 0;
		var newHead = 0;
		var oldTail = oldVKids.length - 1;
		var newTail = newVKids.length - 1;

		isSvg = isSvg || newVNode.tag === 'svg';

		for (var i in { ...oldProps, ...newProps }) {
			if ((i === 'value' || i === 'selected' || i === 'checked' ? node[i] : oldProps[i]) !== newProps[i]) {
				patchProperty(node, i, oldProps[i], newProps[i], isSvg);
			}
		}

		while (newHead <= newTail && oldHead <= oldTail) {
			if ((oldKey = getKey(oldVKids[oldHead])) == null || oldKey !== getKey(newVKids[newHead])) {
				break;
			}

			patch(
				node,
				oldVKids[oldHead].node,
				oldVKids[oldHead],
				(newVKids[newHead] = maybeVNode(newVKids[newHead++], oldVKids[oldHead++])),
				isSvg,
			);
		}

		while (newHead <= newTail && oldHead <= oldTail) {
			if ((oldKey = getKey(oldVKids[oldTail])) == null || oldKey !== getKey(newVKids[newTail])) {
				break;
			}

			patch(
				node,
				oldVKids[oldTail].node,
				oldVKids[oldTail],
				(newVKids[newTail] = maybeVNode(newVKids[newTail--], oldVKids[oldTail--])),
				isSvg,
			);
		}

		if (oldHead > oldTail) {
			while (newHead <= newTail) {
				node.insertBefore(
					createNode((newVKids[newHead] = maybeVNode(newVKids[newHead++])), isSvg),
					(oldVKid = oldVKids[oldHead]) && oldVKid.node,
				);
			}
		} else if (newHead > newTail) {
			while (oldHead <= oldTail) {
				node.removeChild(oldVKids[oldHead++].node);
			}
		} else {
			for (var keyed = {}, newKeyed = {}, i = oldHead; i <= oldTail; i++) {
				if ((oldKey = oldVKids[i].key) != null) {
					keyed[oldKey] = oldVKids[i];
				}
			}

			while (newHead <= newTail) {
				oldKey = getKey((oldVKid = oldVKids[oldHead]));
				newKey = getKey((newVKids[newHead] = maybeVNode(newVKids[newHead], oldVKid)));

				if (newKeyed[oldKey] || (newKey != null && newKey === getKey(oldVKids[oldHead + 1]))) {
					if (oldKey == null) {
						node.removeChild(oldVKid.node);
					}
					oldHead++;
					continue;
				}

				if (newKey == null || oldVNode.type === SSR_NODE) {
					if (oldKey == null) {
						patch(node, oldVKid && oldVKid.node, oldVKid, newVKids[newHead], isSvg);
						newHead++;
					}
					oldHead++;
				} else {
					if (oldKey === newKey) {
						patch(node, oldVKid.node, oldVKid, newVKids[newHead], isSvg);
						newKeyed[newKey] = true;
						oldHead++;
					} else {
						if ((tmpVKid = keyed[newKey]) != null) {
							patch(
								node,
								node.insertBefore(tmpVKid.node, oldVKid && oldVKid.node),
								tmpVKid,
								newVKids[newHead],
								isSvg,
							);
							newKeyed[newKey] = true;
						} else {
							patch(node, oldVKid && oldVKid.node, null, newVKids[newHead], isSvg);
						}
					}
					newHead++;
				}
			}

			while (oldHead <= oldTail) {
				if (getKey((oldVKid = oldVKids[oldHead++])) == null) {
					node.removeChild(oldVKid.node);
				}
			}

			for (var i in keyed) {
				if (newKeyed[i] == null) {
					node.removeChild(keyed[i].node);
				}
			}
		}
	}

	return (newVNode.node = node);
};

var propsChanged = (a, b) => {
	for (var i in a) if (!(i in b)) return true;
	for (var i in b) if (a[i] !== b[i]) return true;
	return false;
};

var maybeVNode = (newVNode, oldVNode) =>
	newVNode !== true && newVNode !== false && newVNode
		? typeof newVNode.tag === 'function'
			? ((!oldVNode || oldVNode.memo == null || propsChanged(oldVNode.memo, newVNode.memo)) &&
					((oldVNode = newVNode.tag(newVNode.memo)).memo = newVNode.memo),
				oldVNode)
			: newVNode
		: text('');

var recycleNode = (node) =>
	node.nodeType === TEXT_NODE
		? text(node.nodeValue, node)
		: createVNode(
				node.nodeName.toLowerCase(),
				EMPTY_OBJ,
				map.call(node.childNodes, recycleNode),
				SSR_NODE,
				node,
			);

var createVNode = (tag, { key, ...props }, children, type, node) => ({
	tag,
	props,
	key,
	children,
	type,
	node,
});

export var memo = (tag, memo) => ({ tag, memo });

export var text = (value, node) => createVNode(value, EMPTY_OBJ, EMPTY_ARR, TEXT_NODE, node);

export var h = (tag, props, children = EMPTY_ARR) =>
	createVNode(tag, props, isArray(children) ? children : [children]);

export var app = ({ node, view }) => {
	var vdom = node && recycleNode(node);
	var render = () => (node = patch(node.parentNode, node, vdom, (vdom = view(render)), false));

	render();
	return render;
};
