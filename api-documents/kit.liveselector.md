<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holoflows/kit](./kit.md) &gt; [LiveSelector](./kit.liveselector.md)

## LiveSelector class

Create a live selector that can continuously select the element you want.

**Signature:**

```typescript
export declare class LiveSelector<T, SingleMode extends boolean = false> 
```

## Remarks

Call [\#evaluate](./kit.liveselector.evaluate.md) to evaluate the element. Falsy value will be ignored.

## Example


```ts
const ls = new LiveSelector().querySelectorAll('a').map(x => x.href)
ls.evaluate() // returns all urls at the current time.
```

## Constructors

<table><thead><tr><th>

Constructor


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[(constructor)(initialElements)](./kit.liveselector._constructor_.md)


</td><td>


</td><td>

Create a new LiveSelector.


</td></tr>
</tbody></table>

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[isSingleMode](./kit.liveselector.issinglemode.md)


</td><td>


</td><td>

boolean


</td><td>

Is this LiveSelector run in the SingleMode


</td></tr>
</tbody></table>

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[at(n)](./kit.liveselector.at.md)


</td><td>


</td><td>

Select only nth element


</td></tr>
<tr><td>

[clone()](./kit.liveselector.clone.md)


</td><td>


</td><td>

Clone this LiveSelector and return a new LiveSelector.


</td></tr>
<tr><td>

[closest(parentOfNth)](./kit.liveselector.closest.md)


</td><td>


</td><td>

Select the nth parent


</td></tr>
<tr><td>

[closest(selectors)](./kit.liveselector.closest_1.md)


</td><td>


</td><td>

Reversely select element in the parent


</td></tr>
<tr><td>

[closest(selectors)](./kit.liveselector.closest_2.md)


</td><td>


</td><td>


</td></tr>
<tr><td>

[closest(selectors)](./kit.liveselector.closest_3.md)


</td><td>


</td><td>


</td></tr>
<tr><td>

[concat(newEle)](./kit.liveselector.concat.md)


</td><td>


</td><td>

Combines two LiveSelector.


</td></tr>
<tr><td>

[enableSingleMode()](./kit.liveselector.enablesinglemode.md)


</td><td>


</td><td>

Enable single mode. Only 1 result will be emitted.


</td></tr>
<tr><td>

[evaluate()](./kit.liveselector.evaluate.md)


</td><td>


</td><td>

Evaluate selector expression


</td></tr>
<tr><td>

[filter(f)](./kit.liveselector.filter.md)


</td><td>


</td><td>

Select the elements of a LiveSelector that meet the condition specified in a callback function.


</td></tr>
<tr><td>

[flat()](./kit.liveselector.flat.md)


</td><td>


</td><td>

Flat T\[\]\[\] to T\[\]


</td></tr>
<tr><td>

[getElementsByClassName(className)](./kit.liveselector.getelementsbyclassname.md)


</td><td>


</td><td>

Select all element base on the current result.


</td></tr>
<tr><td>

[getElementsByTagName(tag)](./kit.liveselector.getelementsbytagname.md)


</td><td>


</td><td>

Select all element base on the current result.


</td></tr>
<tr><td>

[getElementsByTagName(tag)](./kit.liveselector.getelementsbytagname_1.md)


</td><td>


</td><td>


</td></tr>
<tr><td>

[getElementsByTagName(tag)](./kit.liveselector.getelementsbytagname_2.md)


</td><td>


</td><td>


</td></tr>
<tr><td>

[map(callbackfn)](./kit.liveselector.map.md)


</td><td>


</td><td>

Calls a defined callback function on each element of a LiveSelector, and continues with the results.


</td></tr>
<tr><td>

[querySelector(selector)](./kit.liveselector.queryselector.md)


</td><td>


</td><td>

Select the first element that is a descendant of node that matches selectors.


</td></tr>
<tr><td>

[querySelector(selector)](./kit.liveselector.queryselector_1.md)


</td><td>


</td><td>


</td></tr>
<tr><td>

[querySelector(selector)](./kit.liveselector.queryselector_2.md)


</td><td>


</td><td>


</td></tr>
<tr><td>

[querySelectorAll(selector)](./kit.liveselector.queryselectorall.md)


</td><td>


</td><td>

Select all element descendants of node that match selectors.


</td></tr>
<tr><td>

[querySelectorAll(selector)](./kit.liveselector.queryselectorall_1.md)


</td><td>


</td><td>


</td></tr>
<tr><td>

[querySelectorAll(selector)](./kit.liveselector.queryselectorall_2.md)


</td><td>


</td><td>


</td></tr>
<tr><td>

[replace(f)](./kit.liveselector.replace.md)


</td><td>


</td><td>

Replace the whole array.


</td></tr>
<tr><td>

[reverse()](./kit.liveselector.reverse.md)


</td><td>


</td><td>

Reverses the elements in an Array.


</td></tr>
<tr><td>

[slice(start, end)](./kit.liveselector.slice.md)


</td><td>


</td><td>

Returns a section of an array.


</td></tr>
<tr><td>

[sort(compareFn)](./kit.liveselector.sort.md)


</td><td>


</td><td>

Sorts an array.


</td></tr>
</tbody></table>
