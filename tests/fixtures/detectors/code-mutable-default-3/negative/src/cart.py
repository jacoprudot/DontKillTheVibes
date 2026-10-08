# code-mutable-default-3 negative: the default is None and the list is created inside the body, so it must NOT fire; a naive `= []` scan of the whole file would flag it.
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
