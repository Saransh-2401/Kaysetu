from django.apps import AppConfig


class BooksConfig(AppConfig):
    name = "apps.books"
    label = "books"
    verbose_name = "Accounts & Finance (BOOKS)"

    def ready(self):
        from . import capabilities, handlers

        capabilities.register_all()
        handlers.register_all()
