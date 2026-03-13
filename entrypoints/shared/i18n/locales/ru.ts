import type { Dictionary } from "./en";

export const dict: Dictionary = {
  "options.nav.aria": "Разделы настроек",
  "options.nav.activity": "Активность",
  "options.nav.savePaths": "Пути сохранения",
  "options.nav.general": "Общие",
  "options.nav.about": "О расширении",
  "options.about.title": "О расширении",
  "options.about.description":
    "Drive GO - компактное расширение для работы с Google Drive.",
  "options.about.versionLabel": "Версия",
  "general.title": "Общие настройки",
  "general.description":
    "Управляйте поведением загрузок при закрытой боковой панели.",
  "general.loadingAria": "Загрузка общих настроек",
  "general.transfers.title": "Передачи",
  "general.backgroundUpload.title": "Фоновая загрузка",
  "general.backgroundUpload.hint":
    "Если включено, загрузки продолжаются после закрытия расширения. Если выключено, загрузки ставятся на паузу и продолжаются при открытии боковой панели.",
  "general.language.title": "Язык интерфейса",
  "general.language.hint":
    "Выберите язык для страницы настроек и боковой панели.",
  "general.language.aria": "Язык интерфейса",
  "general.language.en": "English",
  "general.language.ru": "Русский",
  "general.language.es": "Español",
  "general.language.pt_BR": "Português (Brasil)",
  "general.language.fr": "Français",
  "general.language.de": "Deutsch",
  "general.language.hi": "हिन्दी",
  "general.language.ar": "العربية",
  "general.language.id": "Bahasa Indonesia",
  "general.language.ja": "日本語",
  "general.language.ko": "한국어",
  "general.language.zh_CN": "简体中文",
  "general.errors.load": "Не удалось загрузить общие настройки",
  "general.errors.save": "Не удалось сохранить общие настройки",
  "activity.title": "Настройки активности",
  "activity.description":
    "Выберите типы уведомлений, которые вы хотите отслеживать.",
  "activity.loadingAria": "Загрузка настроек активности",
  "activity.toast.saved": "Настройки сохранены",
  "activity.errors.save": "Ошибка сохранения настроек",
  "activity.types.title": "Типы активности",
  "activity.type.comment.label": "Комментарии",
  "activity.type.comment.description": "Новые комментарии к вашим файлам",
  "activity.type.reply.label": "Ответы",
  "activity.type.reply.description": "Ответы на ваши комментарии",
  "activity.type.mention.label": "Упоминания",
  "activity.type.mention.description": "Когда вас упоминают в комментариях",
  "activity.type.share.label": "Общий доступ",
  "activity.type.share.description": "Когда с вами делятся файлами",
  "activity.type.edit.label": "Редактирование",
  "activity.type.edit.description": "Изменения в общих файлах",
  "activity.type.create.label": "Создание",
  "activity.type.create.description": "Новые файлы в общих папках",
  "activity.type.permission_change.label": "Изменение прав",
  "activity.type.permission_change.description":
    "Изменения прав доступа к файлам",
  "activity.sync.title": "Синхронизация",
  "activity.sync.interval.title": "Интервал обновления",
  "activity.sync.interval.hint": "Как часто проверять новые уведомления",
  "activity.sync.interval.aria": "Интервал обновления",
  "activity.sync.interval.1": "Каждую минуту",
  "activity.sync.interval.5": "Каждые 5 минут",
  "activity.sync.interval.10": "Каждые 10 минут",
  "activity.sync.interval.15": "Каждые 15 минут",
  "activity.sync.interval.30": "Каждые 30 минут",
  "activity.advanced.title": "Дополнительно",
  "activity.advanced.browserNotifications.title": "Браузерные уведомления",
  "activity.advanced.browserNotifications.hint":
    "Показывать всплывающие уведомления",
  "activity.advanced.sound.title": "Звуковые уведомления",
  "activity.advanced.sound.hint": "Воспроизводить звук при новых событиях",
  "activity.advanced.soundType.title": "Тип звука",
  "activity.advanced.soundType.hint": "Выберите звук уведомления об изменениях",
  "activity.advanced.soundType.aria": "Тип звука",
  "activity.advanced.sound.previewAria": "Прослушать звук",
  "activity.advanced.sound.option.chime": "Chime",
  "activity.advanced.sound.option.bell": "Bell",
  "activity.advanced.sound.option.digital": "Digital",
  "activity.advanced.cleanup.title": "Автоочистка",
  "activity.advanced.cleanup.hint":
    "Удалять уведомления старше указанного срока",
  "activity.advanced.cleanup.aria": "Автоочистка",
  "activity.advanced.cleanup.7": "7 дней",
  "activity.advanced.cleanup.14": "14 дней",
  "activity.advanced.cleanup.30": "30 дней",
  "activity.advanced.cleanup.90": "90 дней",
  "savePaths.title": "Пути сохранения",
  "savePaths.description":
    "Выберите папки Google Drive для автосохранения из контекстного меню.",
  "savePaths.routes.title": "Маршруты сохранения",
  "savePaths.loadingAria": "Загрузка папок",
  "savePaths.row.screenshot.title": "Папка для скриншотов",
  "savePaths.row.screenshot.hint":
    "Если не выбрано, файлы сохраняются в корень Drive.",
  "savePaths.row.selectionText.title": "Папка для выделенного текста",
  "savePaths.row.selectionText.hint":
    "Если не выбрано, txt-файлы сохраняются в корень Drive.",
  "savePaths.row.image.title": "Папка для картинок",
  "savePaths.row.image.hint":
    "Если не выбрано, изображения сохраняются в корень Drive.",
  "savePaths.row.pdf.title": "Папка для PDF",
  "savePaths.row.pdf.hint":
    "Подготовлено заранее: сохранение PDF будет добавлено позже.",
  "savePaths.rootFolder": "Корневая папка",
  "savePaths.folderUnavailable": "Папка недоступна",
  "savePaths.errors.loadFolders": "Не удалось загрузить папки",
  "savePaths.errors.save": "Не удалось сохранить настройки",

  // Drive - filters
  "drive.filter.type.label": "Тип",
  "drive.filter.type.aria": "Фильтр по типу",
  "drive.filter.owner.label": "Люди",
  "drive.filter.owner.aria": "Фильтр по владельцу",
  "drive.filter.modified.label": "Изменено",
  "drive.filter.modified.aria": "Фильтр по дате изменения",
  "drive.filter.clear": "Очистить фильтры",
  "drive.filter.type.all": "Все",
  "drive.filter.type.folders": "Папки",
  "drive.filter.type.documents": "Документы",
  "drive.filter.type.spreadsheets": "Таблицы",
  "drive.filter.type.presentations": "Презентации",
  "drive.filter.type.pdf": "PDF",
  "drive.filter.type.images": "Изображения",
  "drive.filter.type.forms": "Формы",
  "drive.filter.type.archives": "Архивы",
  "drive.filter.type.audio": "Аудио",
  "drive.filter.type.videos": "Видео",
  "drive.filter.type.vids": "Vids",
  "drive.filter.owner.all": "Все",
  "drive.filter.owner.me": "Я",
  "drive.filter.modified.any": "Любое время",
  "drive.filter.modified.7d": "7 дней",
  "drive.filter.modified.30d": "30 дней",
  "drive.filter.modified.365d": "1 год",

  // Drive - toolbar
  "drive.refresh.aria": "Обновить диск",
  "drive.refresh.loading.aria": "Обновляем содержимое диска",
  "drive.refresh.tooltip": "Обновить диск",
  "drive.refresh.loading.tooltip": "Обновляем содержимое диска...",
  "drive.view.aria": "Режим отображения",
  "drive.view.list.aria": "Режим списка",
  "drive.view.list.tooltip": "Список",
  "drive.view.grid.aria": "Режим плиток",
  "drive.view.grid.tooltip": "Плитка",
  "drive.breadcrumbs.aria": "Путь",
  "drive.breadcrumbs.root.myDrive": "Мой диск",
  "drive.breadcrumbs.root.shared": "Доступные мне",
  "drive.breadcrumbs.root.recent": "Недавние",
  "drive.breadcrumbs.root.starred": "Избранные",
  "drive.breadcrumbs.root.trash": "Корзина",

  // Drive - access indicator
  "drive.access.readOnly": "Только просмотр",
  "drive.access.readOnly.tooltip":
    "Право на изменение не выдано. При действиях записи покажем запрос доступа.",

  // Drive - trash banner
  "drive.trash.info":
    "Объекты в корзине удаляются навсегда через 30 дней после попадания в нее.",
  "drive.trash.empty": "Очистить корзину",

  // Drive - create menu
  "drive.create.folder": "Создать папку",
  "drive.create.upload": "Загрузить файлы",
  "drive.create.document": "Google Документы",
  "drive.create.spreadsheets": "Google Таблицы",
  "drive.create.presentation": "Google Презентации",
  "drive.create.forms": "Google Формы",
  "drive.create.vids": "Google Vids",

  // Drive - new folder dialog
  "drive.newFolder.title": "Новая папка",
  "drive.newFolder.defaultName": "Без названия",
  "drive.newFolder.cancel": "Отмена",
  "drive.newFolder.creating": "Создание...",
  "drive.newFolder.create": "Создать",

  // Drive - action toasts
  "drive.toast.close": "Закрыть",
  "drive.toast.addStar.success": "Добавлено в помеченные",
  "drive.toast.addStar.successDesc":
    'Файл "{name}" добавлен в Избранное Google Drive.',
  "drive.toast.addStar.error": "Не удалось добавить в помеченные",
  "drive.toast.removeStar.success": "Убрано из помеченных",
  "drive.toast.removeStar.successDesc":
    'Файл "{name}" удален из Избранного Google Drive.',
  "drive.toast.removeStar.error": "Не удалось убрать пометку",
  "drive.toast.restore.success": "Восстановлено",
  "drive.toast.restore.successDesc": 'Файл "{name}" восстановлен из корзины.',
  "drive.toast.restore.error": "Не удалось восстановить",
  "drive.toast.deleteForever.success": "Удалено навсегда",
  "drive.toast.deleteForever.successDesc": 'Файл "{name}" удален безвозвратно.',
  "drive.toast.deleteForever.error": "Не удалось удалить навсегда",
  "drive.toast.removeShared.success": "Удалено из Доступные мне",
  "drive.toast.removeShared.successDesc":
    'Файл "{name}" больше не отображается в этом разделе.',
  "drive.toast.removeShared.error": "Не удалось удалить из доступа",
  "drive.toast.emptyTrash.success": "Корзина очищена",
  "drive.toast.emptyTrash.successDesc":
    "Все объекты в корзине удалены безвозвратно.",
  "drive.toast.emptyTrash.error": "Не удалось очистить корзину",

  // Drive - empty states
  "drive.empty.myDrive": "В этой папке пока нет файлов и папок.",
  "drive.empty.shared": "Нет файлов, открытых для вас.",
  "drive.empty.recent": "Недавних файлов пока нет.",
  "drive.empty.starred": "Помеченных файлов пока нет.",
  "drive.empty.trash": "Корзина пуста.",

  // Drive - content
  "drive.content.error": "Ошибка: {error}",
  "drive.content.loading": "Загрузка...",
  "drive.content.loadMore": "Показать ещё",
  "drive.content.ownerMe": "Вы",
  "drive.content.loadFolderError": "Не удалось загрузить папку",
  "drive.content.scrollTopAria": "Прокрутить в начало",
  "drive.content.scrollTopLabel": "Наверх",

  // Drive - menu items
  "drive.menu.open": "Открыть",
  "drive.menu.restore": "Восстановить",
  "drive.menu.deleteForever": "Удалить навсегда",
  "drive.menu.share": "Поделиться",
  "drive.menu.addStar": "Добавить в помеченные",
  "drive.menu.removeStar": "Убрать из помеченных",
  "drive.menu.rename": "Переименовать",
  "drive.menu.move": "Переместить",
  "drive.menu.copyLink": "Копировать ссылку",
  "drive.menu.trash": "Отправить в корзину",
  "drive.menu.removeShared": "Удалить",
  "drive.menu.actionsAria": "Действия для {name}",

  // Drive - rename dialog
  "drive.rename.title": "Переименовать",
  "drive.rename.cancel": "Отмена",
  "drive.rename.renaming": "Переименование...",
  "drive.rename.ok": "ОК",
  "drive.rename.permRequired":
    "Для переименования требуется доступ на изменение Google Drive.",

  // Drive - move dialog
  "drive.move.title": 'Перемещение объекта "{name}"',
  "drive.move.loadingFolders": "Загрузка папок...",
  "drive.move.noFolders": "Папки не найдены",
  "drive.move.cancel": "Отмена",
  "drive.move.moving": "Перемещение...",
  "drive.move.move": "Переместить",
  "drive.move.permRequired":
    "Для перемещения требуется доступ на изменение Google Drive.",

  // Drive - trash confirm dialog
  "drive.trashDialog.title": "Отправить в корзину",
  "drive.trashDialog.description": "Объект «{name}» будет перемещён в корзину.",
  "drive.trashDialog.cancel": "Отмена",
  "drive.trashDialog.trashing": "Удаление...",
  "drive.trashDialog.confirm": "В корзину",
  "drive.trashDialog.permRequired":
    "Для удаления в корзину требуется доступ на изменение Google Drive.",

  // Drive - delete forever dialog
  "drive.deleteDialog.title": "Удалить навсегда?",
  "drive.deleteDialog.description":
    'Объект "{name}" будет удален навсегда. Это действие нельзя отменить.',
  "drive.deleteDialog.cancel": "Отмена",
  "drive.deleteDialog.deleting": "Удаление...",
  "drive.deleteDialog.confirm": "Удалить",
  "drive.deleteDialog.error": "Не удалось удалить объект. Попробуйте еще раз.",

  // Drive - empty trash dialog
  "drive.emptyTrashDialog.title": "Удалить навсегда?",
  "drive.emptyTrashDialog.description":
    "Все объекты в корзине будут удалены навсегда. Это действие нельзя отменить.",
  "drive.emptyTrashDialog.cancel": "Отмена",
  "drive.emptyTrashDialog.deleting": "Удаление...",
  "drive.emptyTrashDialog.confirm": "Удалить",
  "drive.emptyTrashDialog.error":
    "Не удалось очистить корзину. Попробуйте еще раз.",

  // Drive - share dialog
  "drive.share.title": "Поделиться «{name}»",
  "drive.share.emailPlaceholder": "Введите email",
  "drive.share.emailError": "Введите корректный email",
  "drive.share.adding": "Добавление...",
  "drive.share.add": "Добавить",
  "drive.share.loadingPermissions": "Загрузка...",
  "drive.share.whoHasAccess": "Кто имеет доступ",
  "drive.share.removeAccess": "Удалить доступ",
  "drive.share.openInDrive": "Открыть настройки доступа в Google Drive",
  "drive.share.done": "Готово",
  "drive.share.role.reader": "Читатель",
  "drive.share.role.commenter": "Комментатор",
  "drive.share.role.writer": "Редактор",
  "drive.share.role.owner": "Владелец",

  // Drive - write permission dialog
  "drive.permission.title": "Нужен доступ на изменение Drive",
  "drive.permission.description":
    "Для этого действия нужно право на изменение файлов в Google Drive. Нажмите «Выдать доступ», чтобы продолжить и автоматически повторить действие.",
  "drive.permission.cancel": "Отмена",
  "drive.permission.requesting": "Запрос прав...",
  "drive.permission.grant": "Выдать доступ",

  // Sidepanel - app shell
  "app.tab.myDrive": "Мой диск",
  "app.tab.recent": "Недавние",
  "app.tab.shared": "Доступные мне",
  "app.tab.starred": "Избранные",
  "app.tab.activity": "Активность",
  "app.tab.transfers": "Передачи",
  "app.tab.trash": "Корзина",
  "app.auth.title": "Войдите в Drive GO",
  "app.auth.description":
    "Для доступа к файлам и активности нужно авторизоваться через Google.",
  "app.auth.checking": "Проверяем сессию...",
  "app.auth.signingIn": "Идет вход...",
  "app.auth.retry": "Повторить вход",
  "app.auth.signIn": "Войти через Google",
  "app.auth.cancel": "Отменить вход",
  "app.auth.error.cancelled":
    "Процесс авторизации был прерван. Нажмите Повторить вход, чтобы продолжить.",
  "app.auth.error.default":
    "Не удалось выполнить вход. Проверьте доступ к интернету и повторите попытку.",
  "app.auth.error.network":
    "Не удалось выполнить вход из-за проблем с сетью. Проверьте интернет и повторите попытку.",
  "app.auth.error.oauthClient":
    "Не удалось выполнить вход: OAuth-клиент отклонил запрос. Если это запуск на другом устройстве, проверьте, что extension ID совпадает с ID, привязанным к OAuth client в Google Cloud.",
  "app.auth.error.permission":
    "Не удалось выполнить вход: доступ не был выдан. Разрешите доступ к аккаунту Google и повторите попытку.",
  "app.auth.error.generic":
    "Не удалось выполнить вход. Повторите попытку. Если ошибка повторяется, проверьте OAuth-настройки расширения.",
  "app.menu.expand": "Раскрыть меню",
  "app.menu.collapse": "Свернуть меню",
  "app.sidebar.aria": "Разделы Google Drive",
  "app.activityUnread": "{count} непрочитанных уведомлений",
  "app.settings": "Настройки",
  "app.placeholder": "Содержимое раздела появится на следующем шаге.",
  "app.size.byte": "Б",
  "app.size.kb": "КБ",
  "app.size.mb": "МБ",
  "app.size.gb": "ГБ",
  "app.size.tb": "ТБ",

  // Sidepanel - search
  "search.input.aria": "Поиск на Диске",
  "search.input.placeholder": "Поиск на Диске",
  "search.clear.aria": "Очистить поиск",
  "search.empty.idle": "Введите запрос или выберите фильтры.",
  "search.empty.loading": "Поиск...",
  "search.empty.noResults": "Ничего не найдено.",

  // Sidepanel - activity
  "activity.browser.title": "Активность",
  "activity.browser.refresh": "Обновить",
  "activity.browser.markAllRead": "Отметить все как прочитанные",
  "activity.browser.access.title": "Нет доступа к активности Google Drive",
  "activity.browser.access.description":
    "Чтобы показывать комментарии, изменения доступа и другие события, нужен отдельный доступ только на чтение активности.",
  "activity.browser.access.notGranted":
    "Доступ к активности Google Drive не был выдан. Проверьте разрешения и попробуйте снова.",
  "activity.browser.access.requesting": "Запрос прав...",
  "activity.browser.access.grant": "Выдать доступ",
  "activity.browser.loading": "Загрузка активности...",
  "activity.browser.empty.title": "Нет новых уведомлений",
  "activity.browser.empty.hint":
    "Здесь будут появляться комментарии, общий доступ и другие события",
  "activity.browser.group.today": "Сегодня",
  "activity.browser.group.yesterday": "Вчера",
  "activity.item.actor.unknown": "Кто-то",
  "activity.item.openFile": "Открыть файл",
  "activity.item.action.comment": "оставил комментарий",
  "activity.item.action.reply": "ответил на комментарий",
  "activity.item.action.mention": "упомянул вас в комментарии",
  "activity.item.action.share": "предоставил доступ к файлу",
  "activity.item.action.edit": "отредактировал файл",
  "activity.item.action.create": "создал файл",
  "activity.item.action.move": "переместил файл",
  "activity.item.action.rename": "переименовал файл",
  "activity.item.action.delete": "удалил файл",
  "activity.item.action.restore": "восстановил файл",
  "activity.item.action.permission_change": "изменил права доступа",
  "activity.item.action.default": "выполнил действие",
  "activity.item.time.justNow": "только что",
  "activity.item.time.minutesAgo": "{count} мин назад",
  "activity.item.time.hoursAgo": "{count} ч назад",
  "activity.item.time.daysAgo": "{count} дн назад",
  "activity.runtime.user": "Пользователь",
  "activity.runtime.loading": "Загрузка...",
  "activity.runtime.untitled": "Безымянный",

  // Background and service runtime
  "background.activityType.comment": "Комментарий",
  "background.activityType.reply": "Ответ",
  "background.activityType.mention": "Упоминание",
  "background.activityType.share": "Общий доступ",
  "background.activityType.edit": "Изменение",
  "background.activityType.create": "Создание",
  "background.activityType.move": "Перемещение",
  "background.activityType.rename": "Переименование",
  "background.activityType.delete": "Удаление",
  "background.activityType.restore": "Восстановление",
  "background.activityType.permissionChange": "Изменение прав",
  "background.notification.singleTitle": "Google Drive: {type}",
  "background.notification.multiTitle": "Google Drive: {count} новых событий",
  "background.notification.multiMessage":
    "Откройте вкладку Активность, чтобы посмотреть детали.",
  "background.contextMenu.screenshot": "Сохранить скрин текущей вкладки",
  "background.contextMenu.selectionText": "Сохранить выделенный текст",
  "background.contextMenu.pdf": "Сохранить страницу как PDF (скоро)",
  "background.contextMenu.image": "Сохранить картинку в Drive",
  "background.error.queueMessage": "Ошибка обработки сообщения очереди",
  "background.error.stagedPayloadMissing":
    "Не удалось получить staged payload для загрузки",
  "background.error.invalidEnqueuePayload":
    "Некорректный payload enqueue-upload: отсутствуют данные файла",
  "background.error.activeTabNotFound":
    "Не удалось определить активную вкладку для скриншота",
  "background.error.selectionTextNotFound": "Выделенный текст не найден",
  "background.error.imageUrlNotFound": "URL картинки не найден",
  "permission.error.requestFailed": "Не удалось запросить права доступа",
  "permission.driveWrite.notGranted":
    "Доступ на изменение Google Drive не был выдан. Проверьте разрешения и попробуйте снова.",
  "permission.activityRead.notGranted":
    "Доступ к активности Google Drive не был выдан. Проверьте разрешения и попробуйте снова.",
  "service.error.unknown": "Неизвестная ошибка",
  "service.error.accessToken": "Не удалось получить токен доступа",
  "service.error.interactiveAuthNoToken":
    "Интерактивная авторизация не вернула токен",
  "service.error.backgroundSyncIncomplete":
    "Фоновая синхронизация активности не выполнена",
  "service.error.invalidEnqueueResponse": "Некорректный ответ enqueue-upload",
  "drive.error.emptyFolderName": "Имя папки не может быть пустым",
  "drive.error.emptyName": "Имя не может быть пустым",
  "drive.error.createFolderStatus": "Ошибка создания папки {status}: {details}",
  "drive.error.moveStatus": "Ошибка перемещения {status}: {details}",
  "drive.error.trashStatus": "Ошибка удаления {status}: {details}",
  "drive.error.renameStatus": "Ошибка переименования {status}: {details}",
  "sharing.error.listPermissionsStatus":
    "Ошибка загрузки прав {status}: {details}",
  "sharing.error.addPermissionStatus": "Ошибка добавления {status}: {details}",
  "sharing.error.deletePermissionStatus":
    "Ошибка удаления доступа {status}: {details}",
  "shared.error.addStarStatus":
    "Ошибка добавления в помеченные {status}: {details}",
  "starred.error.removeStarStatus": "Ошибка снятия пометки {status}: {details}",
  "trash.error.emptyStatus": "Ошибка очистки корзины {status}: {details}",
  "trash.error.restoreStatus": "Ошибка восстановления {status}: {details}",
  "trash.error.deleteForeverStatus": "Ошибка удаления {status}: {details}",
  "shared.error.currentUserNotFound":
    "Не удалось определить текущего пользователя. Проверьте разрешение identity.email.",
  "shared.error.personalPermissionNotFound":
    "Не найдена персональная запись доступа. Возможно, доступ унаследован от группы или домена.",
  "transfer.error.multipartStatus": "Ошибка загрузки {status}: {details}",
  "transfer.error.resumableInitStatus":
    "Ошибка инициализации resumable {status}: {details}",
  "transfer.error.resumableLocationMissing":
    "Не получен Location для resumable upload",
  "transfer.error.resumableProbeStatus":
    "Ошибка проверки resumable сессии {status}: {details}",
  "transfer.error.driveIdMissing": "Drive API не вернул id загруженного файла",
  "transfer.error.driveIdMissingAfterResumable":
    "Drive API не вернул id после resumable upload",
  "transfer.error.resumableExpired":
    "Сессия resumable upload истекла, попробуйте повторить задачу",
  "transfer.error.chunkUploadStatus": "Ошибка chunk upload {status}: {details}",
  "transfer.error.resumableNoFileId": "Resumable upload завершился без file id",
  "transfer.error.payloadNotFound": "Не найден payload задачи в IndexedDB",
  "transfer.error.cancelledByUser": "Отменено пользователем",

  // Sidepanel - transfers
  "transfers.title": "Передачи",
  "transfers.filter.aria": "Фильтр передач",
  "transfers.filter.all": "Все",
  "transfers.filter.uploaded": "Загруженные",
  "transfers.filter.downloaded": "Скачанные",
  "transfers.search.placeholder": "Поиск по имени файла",
  "transfers.sort.aria": "Сортировка",
  "transfers.sort.newest": "Сначала новые",
  "transfers.sort.oldest": "Сначала старые",
  "transfers.sort.nameAsc": "Имя A-Z",
  "transfers.sort.sizeDesc": "Размер по убыванию",
  "transfers.clear.aria": "Очистка передач",
  "transfers.clear.label": "Очистить",
  "transfers.clear.actionsAria": "Действия очистки",
  "transfers.clear.all": "Очистить все",
  "transfers.clear.uploaded": "Очистить загруженные",
  "transfers.clear.downloaded": "Очистить скачанные",
  "transfers.error.load": "Не удалось загрузить передачи",
  "transfers.empty": "Передач пока нет",
  "transfers.meta.folder": "Папка: {name}",
  "transfers.parent.root": "Корневая папка",
  "transfers.status.completed": "Завершено",
  "transfers.status.pending": "В очереди",
  "transfers.status.uploading": "Загрузка {percent}%",
  "transfers.status.downloading": "Скачивание",
  "transfers.status.cancelled": "Пауза",
  "transfers.status.error": "Ошибка",
  "transfers.action.cancel": "Пауза",
  "transfers.action.retry": "Повторить",
  "transfers.action.remove": "Удалить",

  // Sidepanel - upload popover
  "upload.queue.aria": "Очередь загрузок",
  "upload.inline.downloadAdded": "Скачивание добавлено",
  "upload.inline.uploadAdded": "Загрузка добавлена",
  "upload.title": "Загрузки",
  "upload.clear": "Очистить",
  "upload.clearCompleted": "Очистить завершённые",
  "upload.empty": "Нет загрузок",
  "upload.completedSession": "Завершено в этой сессии",
  "upload.completed": "Завершено",
  "upload.status.pending": "В очереди",
  "upload.status.uploading": "Загрузка...",
  "upload.status.downloading": "Скачивание...",
  "upload.status.error": "Ошибка",
  "upload.status.cancelled": "Отменено",
  "upload.action.cancel": "Отменить",
  "upload.action.retry": "Повторить",
  "upload.action.remove": "Удалить",

  // Sidepanel - drag and drop
  "dragDrop.title": "Перетащите файлы сюда",
  "dragDrop.subtitle": "Файлы будут загружены в текущую папку",
};
