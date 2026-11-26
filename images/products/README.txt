Фото товаров. Папка на каждый цветовой вариант, внутри пронумерованные снимки:

  images/products/sm-fl-002-ivory/1-thumb.jpg   превью для карточки каталога (560x640)
  images/products/sm-fl-002-ivory/1.jpg         полноразмерное, открывается по клику
  images/products/sm-fl-002-ivory/2-thumb.jpg   второе фото — карточка станет галереей
  images/products/sm-fl-002-ivory/2.jpg

Первое фото (1-thumb.jpg) показывается на карточке в сетке каталога,
остальные открываются в просмотре по клику.

Как добавить одиночное фото:
  cd исходники
  python3 prepare_photo.py "<файл>" sm-fl-002-ivory        -> фото №1
  python3 prepare_photo.py "<файл>" sm-fl-002-ivory 2      -> фото №2

Товары SUNDAYMORNING, скачанные с Wildberries, готовит другой скрипт —
он сам режет все кадры варианта и печатает строки для catalog.js:
  cd исходники && python3 prepare_catalog.py

Затем в site/catalog.js в колонке «Фото» указать папку и номера:
  sm-fl-002-ivory/1..12
