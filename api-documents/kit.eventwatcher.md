<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holoflows/kit](./kit.md) &gt; [EventWatcher](./kit.eventwatcher.md)

## EventWatcher class

A Watcher based on event handlers.

**Signature:**

```typescript
export declare class EventWatcher<T, Before extends Element = HTMLSpanElement, After extends Element = HTMLSpanElement, SingleMode extends boolean = false> extends Watcher<T, Before, After, SingleMode> 
```
**Extends:** [Watcher](./kit.watcher.md)<!-- -->&lt;T, Before, After, SingleMode&gt;

## Example


```ts
const e = new EventWatcher(ls).useForeach(node => console.log(node))
document.addEventListener('event', e.eventListener)
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

[(constructor)(liveSelector)](./kit.eventwatcher._constructor_.md)


</td><td>


</td><td>

Constructs a new instance of the `EventWatcher` class


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

[eventListener](./kit.eventwatcher.eventlistener.md)


</td><td>


</td><td>

() =&gt; void


</td><td>

Use this function as event listener to invoke watcher.


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

[startWatch(signal)](./kit.eventwatcher.startwatch.md)


</td><td>


</td><td>


</td></tr>
</tbody></table>
