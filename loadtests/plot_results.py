import pandas as pd
import matplotlib.pyplot as plt

# ===== Чтение данных =====
history = pd.read_csv('stability_stats_history.csv')
stats = pd.read_csv('stability_stats.csv')

# Удаляем строки с NaN в процентилях (первые секунды без данных)
history = history.dropna(subset=['95%', '99%'])

# Преобразуем timestamp в секунды от начала теста
history['Time_sec'] = history['Timestamp'] - history['Timestamp'].iloc[0]

# ===== 1. Динамика нагрузки (RPS и пользователи) =====
fig, ax1 = plt.subplots(figsize=(10, 5))

ax1.set_xlabel('Время, с')
ax1.set_ylabel('RPS', color='tab:blue')
# Используем готовую колонку Requests/s (если есть), иначе вычисляем diff
if 'Requests/s' in history.columns:
    ax1.plot(history['Time_sec'], history['Requests/s'], color='tab:blue', label='RPS')
else:
    ax1.plot(history['Time_sec'], history['Total Request Count'].diff().fillna(0),
             color='tab:blue', label='RPS')
ax1.tick_params(axis='y', labelcolor='tab:blue')

ax2 = ax1.twinx()
ax2.set_ylabel('Число пользователей', color='tab:red')
ax2.plot(history['Time_sec'], history['User Count'], color='tab:red', label='Users')
ax2.tick_params(axis='y', labelcolor='tab:red')

plt.title('Динамика нагрузки')
fig.tight_layout()
plt.savefig('rps_users.png', dpi=150)
plt.show()

# ===== 2. Время ответа (среднее, p95, p99) =====
plt.figure(figsize=(10, 5))
plt.plot(history['Time_sec'], history['Total Average Response Time'],
         label='Avg', color='green')
plt.plot(history['Time_sec'], history['95%'], label='p95', color='orange')
plt.plot(history['Time_sec'], history['99%'], label='p99', color='red')
plt.xlabel('Время, с')
plt.ylabel('Время ответа, мс')
plt.title('Время ответа (агрегированное)')
plt.legend()
plt.grid(True)
plt.savefig('response_times.png', dpi=150)
plt.show()

# ===== 3. Среднее время по эндпоинтам =====
# Отбираем только строки с конкретными методами (исключаем Aggregated)
endpoints = stats[stats['Name'] != 'Aggregated'].copy()

# Диагностика (можно убрать)
print("Данные по эндпоинтам:")
print(endpoints[['Type', 'Name', 'Average Response Time', '95%', '99%', '100%']])

# Строим столбчатую диаграмму
x = range(len(endpoints))
fig, ax = plt.subplots(figsize=(12, 6))
ax.bar(x, endpoints['Average Response Time'],
       tick_label=endpoints['Type'] + ' ' + endpoints['Name'])
ax.set_ylabel('Среднее время ответа, мс')
ax.set_title('Среднее время ответа по эндпоинтам')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.savefig('avg_by_endpoint.png', dpi=150)
plt.show()

# ===== 4. Процентили по эндпоинтам (p95, p99, max) =====
fig, ax = plt.subplots(figsize=(12, 6))
bar_width = 0.25
x = range(len(endpoints))

ax.bar([i - bar_width for i in x], endpoints['95%'], bar_width, label='p95')
ax.bar(x, endpoints['99%'], bar_width, label='p99')
ax.bar([i + bar_width for i in x], endpoints['100%'], bar_width, label='max')

ax.set_xticks(x)
ax.set_xticklabels(endpoints['Type'] + ' ' + endpoints['Name'], rotation=45, ha='right')
ax.set_ylabel('Время ответа, мс')
ax.set_title('Процентили по эндпоинтам')
ax.legend()
plt.tight_layout()
plt.savefig('percentiles_by_endpoint.png', dpi=150)
plt.show()

print("Все графики сохранены.")