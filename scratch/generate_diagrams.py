import os
from PIL import Image, ImageDraw, ImageFont

def draw_multiline_centered_text(draw, text, box, font, color):
    bx1, by1, bx2, by2 = box
    lines = text.split('\n')
    line_heights = []
    line_widths = []
    for line in lines:
        try:
            bbox = draw.textbbox((0, 0), line, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
        except AttributeError:
            tw, th = draw.textsize(line, font=font)
        line_widths.append(tw)
        line_heights.append(th)
        
    total_h = sum(line_heights) + 4 * (len(lines) - 1)
    current_y = by1 + (by2 - by1 - total_h) / 2
    
    for i, line in enumerate(lines):
        tw = line_widths[i]
        th = line_heights[i]
        tx = bx1 + (bx2 - bx1 - tw) / 2
        draw.text((tx, current_y), line, fill=color, font=font)
        current_y += th + 4

def draw_arrow(draw, start, end, fill="black", width=2):
    x1, y1 = start
    x2, y2 = end
    draw.line([start, end], fill=fill, width=width)
    
    # Arrow head
    import math
    angle = math.atan2(y2 - y1, x2 - x1)
    arrow_len = 10
    px1 = x2 - arrow_len * math.cos(angle - math.pi/6)
    py1 = y2 - arrow_len * math.sin(angle - math.pi/6)
    px2 = x2 - arrow_len * math.cos(angle + math.pi/6)
    py2 = y2 - arrow_len * math.sin(angle + math.pi/6)
    draw.polygon([(x2, y2), (px1, py1), (px2, py2)], fill=fill)

def generate_architecture_diagram(output_path, font_path="arial.ttf"):
    img = Image.new("RGB", (800, 450), "white")
    draw = ImageDraw.Draw(img)
    
    try:
        font_title = ImageFont.truetype(font_path, 16)
        font_body = ImageFont.truetype(font_path, 12)
        font_bold = ImageFont.truetype(font_path, 12)
    except IOError:
        font_title = ImageFont.load_default()
        font_body = ImageFont.load_default()
        font_bold = ImageFont.load_default()
        
    # Draw title
    draw.text((20, 20), "Схема архитектуры системы «Evolutio» (Client-Server)", fill="black", font=font_title)
    
    # Clients Box (Left)
    draw.rectangle([40, 70, 360, 390], outline="black", width=2)
    draw.text((50, 80), "КЛИЕНТСКАЯ ЧАСТЬ (Браузер)", fill="blue", font=font_bold)
    
    # Organism Client Box
    box_org = (60, 110, 340, 220)
    draw.rectangle(box_org, fill=(220, 255, 220), outline="black", width=1)
    draw_multiline_centered_text(draw, "Роль: Организм\n- Phaser 3 Game Engine (HTML5 Canvas)\n- Управление перемещением\n- Сбор пищи / Получение урона\n- Локальный рендеринг HUD", box_org, font_body, "black")
    
    # Geneticist Client Box
    box_gen = (60, 250, 340, 360)
    draw.rectangle(box_gen, fill=(240, 220, 255), outline="black", width=1)
    draw_multiline_centered_text(draw, "Роль: Генетик\n- Панель управления (HTML5 / CSS3)\n- Chart.js (Графики ЧСС/ДНК)\n- Покупка мутаций (Mutation Tree)\n- Логгер событий реального времени", box_gen, font_body, "black")
    
    # Server Box (Right)
    draw.rectangle([440, 70, 760, 390], outline="black", width=2)
    draw.text((450, 80), "СЕРВЕРНАЯ ЧАСТЬ (Node.js)", fill="red", font=font_bold)
    
    # HTTP/Express
    box_exp = (460, 110, 740, 170)
    draw.rectangle(box_exp, fill=(255, 240, 220), outline="black", width=1)
    draw_multiline_centered_text(draw, "Express Web Server\n- Статическая раздача файлов клиента\n- Маршрутизация лобби", box_exp, font_body, "black")
    
    # Socket.io Server
    box_sock = (460, 190, 740, 250)
    draw.rectangle(box_sock, fill=(210, 230, 255), outline="black", width=1)
    draw_multiline_centered_text(draw, "Socket.io Server\n- Обработка WebSocket-подключений\n- Изоляция комнат (Rooms ID)", box_sock, font_body, "black")
    
    # GameSession Manager
    box_sess = (460, 270, 740, 370)
    draw.rectangle(box_sess, fill=(210, 230, 255), outline="black", width=1)
    draw_multiline_centered_text(draw, "Авторитарный Менеджер Сессии\n- Класс GameSession\n- Каталог MUTATIONS & STAGES\n- Валидация ДНК / Урон / Процедурный мир\n- Интервал обновления истории графиков (1с)", box_sess, font_body, "black")
    
    # Network Arrows
    # Organism <-> Socket.io (Bi-directional)
    draw_arrow(draw, (340, 165), (460, 210), fill="darkgreen", width=2)
    draw_arrow(draw, (460, 210), (340, 165), fill="darkgreen", width=2)
    draw.text((365, 150), "WebSockets", fill="darkgreen", font=font_body)
    
    # Geneticist <-> Socket.io (Bi-directional)
    draw_arrow(draw, (340, 305), (460, 230), fill="purple", width=2)
    draw_arrow(draw, (460, 230), (340, 305), fill="purple", width=2)
    draw.text((365, 270), "WebSockets", fill="purple", font=font_body)
    
    img.save(output_path)

def generate_evolution_flowchart(output_path, font_path="arial.ttf"):
    img = Image.new("RGB", (800, 400), "white")
    draw = ImageDraw.Draw(img)
    
    try:
        font_title = ImageFont.truetype(font_path, 16)
        font_body = ImageFont.truetype(font_path, 11)
        font_bold = ImageFont.truetype(font_path, 12)
    except IOError:
        font_title = ImageFont.load_default()
        font_body = ImageFont.load_default()
        font_bold = ImageFont.load_default()
        
    draw.text((20, 20), "Схема эволюционного прогресса и концовок в «Evolutio»", fill="black", font=font_title)
    
    # Stage Boxes
    stages = [
        ("Этап 1: Клетка", "Первичный бульон\nПорог: 100 ДНК\nМутации: Жгутик,\nМембрана, Рецептор", (40, 120, 180, 200), (220, 240, 255)),
        ("Этап 2: Рыба", "Океанские глубины\nПорог: 250 ДНК\nМутации: Плавник,\nЖабры, Панцирь", (220, 120, 360, 200), (200, 255, 200)),
        ("Этап 3: Рептилия", "Выход на сушу\nПорог: 500 ДНК\nМутации: Лапы,\nМозг, Кости", (400, 120, 540, 200), (255, 240, 200)),
        ("Этап 4: Гуманоид", "Древние Руины\nПорог: 800 ДНК\nМутации: Броня, Кора,\nПрямохождение, НКИ", (580, 120, 760, 200), (255, 220, 220))
    ]
    
    for title, desc, box, color in stages:
        draw.rectangle(box, fill=color, outline="black", width=1)
        draw_multiline_centered_text(draw, f"{title}\n{desc}", box, font_body, "black")
        
    # Connect stages
    draw_arrow(draw, (180, 160), (220, 160), fill="black", width=2)
    draw_arrow(draw, (360, 160), (400, 160), fill="black", width=2)
    draw_arrow(draw, (540, 160), (580, 160), fill="black", width=2)
    
    # Endings (under Stage 4)
    endings = [
        ("Техно-концовка", "Взлом терминала 'cyber'\nСознание загружено в сеть", (450, 280, 590, 360), (230, 220, 255)),
        ("Био-концовка", "Взлом терминала 'nature'\nБиосфера восстановлена", (600, 280, 740, 360), (220, 255, 230)),
        ("Военная концовка", "Взлом терминала 'weapon'\nСтанция перегружена", (300, 280, 440, 360), (255, 220, 220))
    ]
    
    for title, desc, box, color in endings:
        draw.rectangle(box, fill=color, outline="black", width=1)
        draw_multiline_centered_text(draw, f"{title}\n{desc}", box, font_body, "black")
        
    # Connect Stage 4 to Endings
    # From bottom of Stage 4 (670, 200) to endings top
    draw_arrow(draw, (670, 200), (370, 280), fill="darkred", width=1)
    draw_arrow(draw, (670, 200), (520, 280), fill="darkred", width=1)
    draw_arrow(draw, (670, 200), (670, 280), fill="darkred", width=1)
    
    img.save(output_path)

def generate_sync_sequence(output_path, font_path="arial.ttf"):
    img = Image.new("RGB", (800, 450), "white")
    draw = ImageDraw.Draw(img)
    
    try:
        font_title = ImageFont.truetype(font_path, 16)
        font_body = ImageFont.truetype(font_path, 11)
        font_bold = ImageFont.truetype(font_path, 12)
    except IOError:
        font_title = ImageFont.load_default()
        font_body = ImageFont.load_default()
        font_bold = ImageFont.load_default()
        
    draw.text((20, 20), "Диаграмма последовательности синхронизации состояния", fill="black", font=font_title)
    
    # Draw Lifelines
    columns = [
        ("Организм (Phaser Client)", 150),
        ("Сервер (Node.js / Socket.io)", 400),
        ("Генетик (UI Panel)", 650)
    ]
    
    for name, x in columns:
        draw.rectangle([x-80, 50, x+80, 80], fill=(240, 240, 240), outline="black")
        draw_multiline_centered_text(draw, name, (x-80, 50, x+80, 80), font_bold, "black")
        draw.line([(x, 80), (x, 420)], fill="gray", width=1, joint="miter")
        
    # Sequence interactions (y coordinate is time)
    # 1. collect-food
    y = 110
    draw_arrow(draw, (150, y), (400, y), fill="blue", width=2)
    draw.text((160, y-15), "1. socket.emit('collect-food', {foodId})", fill="blue", font=font_body)
    
    # 2. food-collected broadcast
    y = 150
    draw_arrow(draw, (400, y), (150, y), fill="darkgreen", width=2)
    draw_arrow(draw, (400, y), (650, y), fill="darkgreen", width=2)
    draw.text((200, y-15), "2. io.to(room).emit('food-collected', ...)", fill="darkgreen", font=font_body)
    
    # 3. sync-charts (periodic)
    y = 200
    draw_arrow(draw, (400, y), (650, y), fill="purple", width=2)
    draw.text((420, y-15), "3. emit('sync-charts', {statsHistory})", fill="purple", font=font_body)
    
    # 4. trigger-mutation
    y = 260
    draw_arrow(draw, (650, y), (400, y), fill="red", width=2)
    draw.text((420, y-15), "4. emit('trigger-mutation', {mutationId})", fill="red", font=font_body)
    
    # 5. mutation-applied broadcast
    y = 310
    draw_arrow(draw, (400, y), (150, y), fill="orange", width=2)
    draw_arrow(draw, (400, y), (650, y), fill="orange", width=2)
    draw.text((200, y-15), "5. emit('mutation-applied', ...)", fill="orange", font=font_body)
    
    # 6. take-damage
    y = 370
    draw_arrow(draw, (150, y), (400, y), fill="darkred", width=2)
    draw.text((160, y-15), "6. emit('take-damage', {amount, reason})", fill="darkred", font=font_body)
    
    img.save(output_path)

if __name__ == "__main__":
    os.makedirs("scratch", exist_ok=True)
    generate_architecture_diagram("scratch/architecture_diagram.png")
    generate_evolution_flowchart("scratch/evolution_flowchart.png")
    generate_sync_sequence("scratch/sync_sequence.png")
    print("Diagrams generated successfully in scratch/")
