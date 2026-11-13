from importlib import import_module
from pkgutil import iter_modules

for rule_module in sorted(module.name for module in iter_modules(__path__)):
    import_module(f"{__name__}.{rule_module}")
