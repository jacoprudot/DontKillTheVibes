# code-mutable-default-3 positive: `items=[]` is one list object shared by every call, so this file MUST fire.
def add_item(item, items=[]):
    items.append(item)
    return items
