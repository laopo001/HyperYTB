import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import 'package:url_launcher/url_launcher.dart';
import 'package:awesome_notifications/awesome_notifications.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:app_settings/app_settings.dart';
import 'package:awesome_notifications/android_foreground_service.dart';

final InAppLocalhostServer localhostServer =
    InAppLocalhostServer(documentRoot: 'assets', port: 18191);

const isDev = kDebugMode;
const notificationId = 10;
Future main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (!isDev && !kIsWeb) {
    // start the localhost server

    try {
      await localhostServer.start();
    } catch (e) {
      debugPrint(e.toString());
    }
    debugPrint("started");
  }

  if (!isDev && !kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    await InAppWebViewController.setWebContentsDebuggingEnabled(kDebugMode);
  }

  runApp(const MaterialApp(home: MyApp()));
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class NotificationController {
  /// Use this method to detect when a new notification or a schedule is created
  @pragma("vm:entry-point")
  static Future<void> onNotificationCreatedMethod(
      ReceivedNotification receivedNotification) async {
    // Your code goes here
  }

  /// Use this method to detect every time that a new notification is displayed
  @pragma("vm:entry-point")
  static Future<void> onNotificationDisplayedMethod(
      ReceivedNotification receivedNotification) async {
    // Your code goes here
  }

  /// Use this method to detect if the user dismissed a notification
  @pragma("vm:entry-point")
  static Future<void> onDismissActionReceivedMethod(
      ReceivedAction receivedAction) async {
    // Your code goes here
  }

  /// Use this method to detect when the user taps on a notification or action button
  @pragma("vm:entry-point")
  static Future<void> onActionReceivedMethod(
      ReceivedAction receivedAction) async {
    // Your code goes here

    // Navigate into pages, avoiding to open the notification details page over another details page already opened
  }
}

class _MyAppState extends State<MyApp> {
  final List<Map<String, dynamic>> _services = [];
  @override
  void initState() {
    debugPrint("kIsWeb: $kIsWeb isDev: $isDev");
    AwesomeNotifications().initialize(
        // 将图标设置为 null 以使用默认应用图标
        null,
        [
          NotificationChannel(
              channelGroupKey: 'basic_channel_group',
              channelKey: 'basic_channel',
              channelName: 'Basic notifications',
              channelDescription: 'Notification channel for basic tests',
              defaultColor: Color(0xFF9D50DD),
              ledColor: Colors.white),
        ],
        // Channel groups are only visual and are not required
        channelGroups: [
          NotificationChannelGroup(
              channelGroupKey: 'basic_channel_group',
              channelGroupName: 'Basic group')
        ],
        debug: true);
    AwesomeNotifications().setListeners(
        onActionReceivedMethod: NotificationController.onActionReceivedMethod,
        onNotificationCreatedMethod:
            NotificationController.onNotificationCreatedMethod,
        onNotificationDisplayedMethod:
            NotificationController.onNotificationDisplayedMethod,
        onDismissActionReceivedMethod:
            NotificationController.onDismissActionReceivedMethod);
    AwesomeNotifications().isNotificationAllowed().then((isAllowed) {
      if (!isAllowed) {
        // This is just a basic example. For real apps, you must show some
        // friendly dialog box before call the request method.
        // This is very important to not harm the user experience
        AwesomeNotifications().requestPermissionToSendNotifications();
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkWifiStatus();
    });

    super.initState();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _showMyDialog() async {
    showDialog<void>(
      context: context,
      barrierDismissible: false, // 用户必须点击按钮才能关闭对话框
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('提示'),
          content: const SingleChildScrollView(
            child: ListBody(
              children: <Widget>[
                Text('需要要连接WiFi'),
                Text('该应用使用局域网连接'),
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(
              child: const Text('确定'),
              onPressed: () {
                Navigator.of(context).pop();
              },
            ),
            TextButton(
              child: const Text('打开设置'),
              onPressed: () {
                AppSettings.openAppSettingsPanel(AppSettingsPanelType.wifi);
              },
            ),
          ],
        );
      },
    );
  }

  Future<void> _checkWifiStatus() async {
    var connectivityResult = await (Connectivity().checkConnectivity());
    if (connectivityResult.contains(ConnectivityResult.wifi)) {
      debugPrint('连接到 WiFi');
    } else {
      debugPrint('未连接到 WiFi');
      _showMyDialog();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
          child: Column(children: <Widget>[
        Expanded(
          child: InAppWebView(
            initialSettings: InAppWebViewSettings(
              mediaPlaybackRequiresUserGesture: false,
              allowBackgroundAudioPlaying: true,
              allowsInlineMediaPlayback: true,
              isInspectable: kDebugMode,
            ),
            initialUrlRequest:
                URLRequest(url: WebUri("https://m.youtube.com/")),
            onWebViewCreated: (controller) {},
            onLoadStart: (controller, url) {
              debugPrint('onLoadStart: $url');
              controller.addJavaScriptHandler(
                  handlerName: 'log',
                  callback: (args) {
                    // print arguments coming from the JavaScript side!
                    debugPrint("log $args");
                    // return data to the JavaScript side
                  });
              controller.addJavaScriptHandler(
                  handlerName: 'getUserDataPath',
                  callback: (args) async {
                    var directory = await getApplicationDocumentsDirectory();
                    return directory.path;
                  });
              controller.addJavaScriptHandler(
                  handlerName: 'readFile',
                  callback: (args) async {
                    // print("readFile $args");
                    String fileName = args[0];
                    var directory = await getApplicationDocumentsDirectory();
                    File file = File('${directory.path}/$fileName');
                    if (await file.exists()) {
                      return await file.readAsString();
                    } else {
                      return '';
                    }
                  });
              controller.addJavaScriptHandler(
                  handlerName: 'writeFile',
                  callback: (args) async {
                    String fileName = args[0];
                    String content = args[1];
                    var directory = await getApplicationDocumentsDirectory();
                    File file = File('${directory.path}/$fileName');
                    await file.writeAsString(content);
                  });
              controller.addJavaScriptHandler(
                  handlerName: 'readDir',
                  callback: (args) async {
                    var directory = await getApplicationDocumentsDirectory();
                    List<FileSystemEntity> files = directory.listSync();
                    List<String> fileNames =
                        files.map((file) => file.path).toList();
                    return fileNames;
                  });
              controller.addJavaScriptHandler(
                  handlerName: 'createMediaNotification',
                  callback: (args) async {
                    if (Platform.isAndroid) {
                      await AndroidForegroundService
                          .startAndroidForegroundService(
                        foregroundStartMode: ForegroundStartMode.stick,
                        foregroundServiceType:
                            ForegroundServiceType.mediaPlayback,
                        content: NotificationContent(
                            id: notificationId,
                            actionType: ActionType.Default,
                            title: 'hyperytb playing!',
                            channelKey: 'basic_channel',
                            locked: true,
                            autoDismissible: false,
                            notificationLayout: NotificationLayout.MediaPlayer,
                            category: NotificationCategory.Service),
                      );
                    } else {
                      await AwesomeNotifications().createNotification(
                          content: NotificationContent(
                              id: notificationId,
                              channelKey: 'basic_channel',
                              actionType: ActionType.Default,
                              title: 'hyperytb playing!',
                              locked: true,
                              autoDismissible: false,
                              notificationLayout:
                                  NotificationLayout.MediaPlayer));
                    }
                  });
              controller.addJavaScriptHandler(
                  handlerName: 'closeMediaNotification',
                  callback: (args) async {
                    if (Platform.isAndroid) {
                      AndroidForegroundService.stopForeground(notificationId);
                    } else {
                      AwesomeNotifications().dismiss(notificationId);
                    }
                  });
            },
            shouldOverrideUrlLoading: (controller, navigationAction) async {
              var uri = navigationAction.request.url;
              // var scheme = uri?.scheme;
              // debugPrint('shouldOverrideUrlLoading: $uri $scheme');
              if (uri != null && uri.scheme == "mailto") {
                // debugPrint('Launched test');
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri);
                }
                return NavigationActionPolicy.CANCEL;
              }
              if (uri != null &&
                  uri.toString().startsWith("https://www.dadigua.men")) {
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri);
                }
                return NavigationActionPolicy.CANCEL;
              }
              return NavigationActionPolicy.ALLOW;
            },
            onLoadStop: (controller, url) async {
              debugPrint('onLoadStop: $url');

              // var result = await controller.evaluateJavascript(
              //     source:
              //         "setTimeout(() => {window.href='http://localhost:18191/index.html';}, 10000); 123123");

              // debugPrint(result.toString()); // 2
            },
          ),
        )
      ])),
      // floatingActionButton: favoriteButton(),
    );
  }
}

Map<String, String> _parseTxtRecord(String txt) {
  final Map<String, String> txtMap = {};
  final List<String> entries = txt.split('\n');
  for (final entry in entries) {
    final List<String> keyValue = entry.split('=');
    if (keyValue.length == 2) {
      txtMap[keyValue[0]] = keyValue[1];
    }
  }
  return txtMap;
}
