<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holoflows/kit](./kit.md) &gt; [LiveSelector](./kit.liveselector.md) &gt; [closest](./kit.liveselector.closest.md)

## LiveSelector.closest() method

Select the nth parent

**Signature:**

```typescript
closest<T>(parentOfNth: number): LiveSelector<T, SingleMode>;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

parentOfNth


</td><td>

number


</td><td>


</td></tr>
</tbody></table>
**Returns:**

[LiveSelector](./kit.liveselector.md)<!-- -->&lt;T, SingleMode&gt;

## Example


```ts
ls.closest(2) // parentElement.parentElement
```

