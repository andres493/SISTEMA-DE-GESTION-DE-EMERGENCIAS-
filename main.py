 # -*- coding: utf-8 -*-
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import sqlite3
import csv
import os
import shutil
from datetime import datetime
import sys

class BomberosApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Sistema de Gestión de Emergencias - Bomberos Colombia")
        self.root.geometry("1200x800")
        self.root.minsize(1000, 700)
        
        # Configurar base de datos
        self.db_name = "bomberos_emergencias.db"
        self.init_database()
        
        # Crear interfaz
        self.create_menu()
        self.create_notebook()
        self.create_entry_form()
        self.create_records_view()
        
        # Cargar registros iniciales
        self.load_records()
    
    def init_database(self):
        """Inicializa la base de datos SQLite y crea la tabla si no existe"""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS emergencias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha TEXT NOT NULL,
                hora TEXT,
                municipio TEXT,
                tipo_incidente TEXT,
                entidad_apoyo TEXT,
                nombre_atendio TEXT,
                rango_atendio TEXT,
                nombre_paciente TEXT,
                identificacion_paciente TEXT,
                edad TEXT,
                sexo TEXT,
                barrio_vereda TEXT,
                direccion TEXT,
                telefono TEXT,
                total_afectados TEXT,
                perdidas TEXT,
                unidades TEXT,
                vehiculos TEXT,
                departamento TEXT NOT NULL,
                codigo_emergencia TEXT,
                observaciones TEXT,
                timestamp TEXT NOT NULL
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def create_menu(self):
        """Crea la barra de menú"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # Menú Archivo
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Archivo", menu=file_menu)
        file_menu.add_command(label="Respaldar Base de Datos", command=self.backup_database)
        file_menu.add_command(label="Restaurar Base de Datos", command=self.restore_database)
        file_menu.add_separator()
        file_menu.add_command(label="Salir", command=self.root.quit)
        
        # Menú Ayuda
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Ayuda", menu=help_menu)
        help_menu.add_command(label="Acerca de", command=self.show_about)
    
    def create_notebook(self):
        """Crea el sistema de pestañas"""
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Pestaña de entrada de datos
        self.entry_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.entry_frame, text="Ingreso de Emergencias")
        
        # Pestaña de visualización de registros
        self.records_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.records_frame, text="Ver Registros")
    
    def create_entry_form(self):
        """Crea el formulario de entrada de datos"""
        # Frame principal con scrollbar
        canvas = tk.Canvas(self.entry_frame)
        scrollbar = ttk.Scrollbar(self.entry_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Título
        title_label = ttk.Label(scrollable_frame, text="Ingreso de Datos de Emergencia", 
                               font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=2, pady=20)
        
        # Definir campos del formulario
        fields = [
            ("Fecha:", "fecha", "date"),
            ("Hora:", "hora", "time"),
            ("Municipio:", "municipio", "text"),
            ("Tipo de Incidente:", "tipo_incidente", "combobox", [
                "Incendio", "Explosión", "Inspección", "Despeje Vial",
                "Control de Hidrocarburos", "Control de Abejas", "Accidente de Tránsito",
                "Atención a Paciente", "Rescate", "Fuga", "Derrame", "Deslizamiento",
                "Desfile", "Simulacro", "Suministro de Agua", "Entrega de Ayudas",
                "Censo", "Otro"
            ]),
            ("Entidad que Apoya:", "entidad_apoyo", "text"),
            ("Nombre del que Atiende:", "nombre_atendio", "text"),
            ("Rango:", "rango_atendio", "text"),
            ("Nombre del Paciente Afectado:", "nombre_paciente", "text"),
            ("Identificación del Paciente:", "identificacion_paciente", "text"),
            ("Edad:", "edad", "number"),
            ("Sexo:", "sexo", "combobox", ["Masculino", "Femenino", "Otro"]),
            ("Barrio o Vereda:", "barrio_vereda", "text"),
            ("Dirección:", "direccion", "text"),
            ("Teléfono:", "telefono", "text"),
            ("Total de Afectados:", "total_afectados", "number"),
            ("Pérdidas (descripción):", "perdidas", "text"),
            ("Unidades:", "unidades", "text"),
            ("Vehículos:", "vehiculos", "text"),
            ("Departamento de Colombia:", "departamento", "combobox", [
                "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar",
                "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó",
                "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira",
                "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo",
                "Quindío", "Risaralda", "San Andrés y Providencia", "Santander",
                "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada"
            ]),
            ("Código de Emergencia:", "codigo_emergencia", "text"),
            ("Observaciones:", "observaciones", "textarea")
        ]
        
        self.entries = {}
        row = 1
        
        for field_info in fields:
            label_text = field_info[0]
            field_name = field_info[1]
            field_type = field_info[2]
            
            # Etiqueta
            label = ttk.Label(scrollable_frame, text=label_text, font=("Arial", 10, "bold"))
            label.grid(row=row, column=0, sticky="e", padx=10, pady=5)
            
            # Campo de entrada según tipo
            if field_type == "text":
                entry = ttk.Entry(scrollable_frame, width=40)
                entry.grid(row=row, column=1, sticky="w", padx=10, pady=5)
                self.entries[field_name] = entry
                
            elif field_type == "number":
                entry = ttk.Entry(scrollable_frame, width=40)
                entry.grid(row=row, column=1, sticky="w", padx=10, pady=5)
                self.entries[field_name] = entry
                
            elif field_type == "date":
                entry = ttk.Entry(scrollable_frame, width=40)
                entry.grid(row=row, column=1, sticky="w", padx=10, pady=5)
                # Establecer fecha actual por defecto
                entry.insert(0, datetime.now().strftime("%Y-%m-%d"))
                self.entries[field_name] = entry
                
            elif field_type == "time":
                entry = ttk.Entry(scrollable_frame, width=40)
                entry.grid(row=row, column=1, sticky="w", padx=10, pady=5)
                # Establecer hora actual por defecto
                entry.insert(0, datetime.now().strftime("%H:%M"))
                self.entries[field_name] = entry
                
            elif field_type == "combobox":
                values = field_info[3]
                entry = ttk.Combobox(scrollable_frame, values=values, width=37, state="readonly")
                entry.grid(row=row, column=1, sticky="w", padx=10, pady=5)
                self.entries[field_name] = entry
                
            elif field_type == "textarea":
                entry = tk.Text(scrollable_frame, width=40, height=4, wrap=tk.WORD)
                entry.grid(row=row, column=1, sticky="w", padx=10, pady=5)
                self.entries[field_name] = entry
            
            row += 1
        
        # Botones de acción
        button_frame = ttk.Frame(scrollable_frame)
        button_frame.grid(row=row, column=0, columnspan=2, pady=20)
        
        save_btn = ttk.Button(button_frame, text="Guardar Emergencia", 
                             command=self.save_emergency, style="Accent.TButton")
        save_btn.pack(side=tk.LEFT, padx=10)
        
        clear_btn = ttk.Button(button_frame, text="Limpiar Formulario", 
                             command=self.clear_form)
        clear_btn.pack(side=tk.LEFT, padx=10)
        
        # Configurar estilo para botón destacado
        style = ttk.Style()
        style.configure("Accent.TButton", background="#8b0000", foreground="white")
    
    def create_records_view(self):
        """Crea la vista de registros en formato de tabla"""
        # Frame para la tabla y scrollbars
        tree_frame = ttk.Frame(self.records_frame)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Crear Treeview
        columns = (
            "fecha", "codigo", "hora", "municipio", "departamento", 
            "tipo", "entidad", "paciente", "total_afectados", "acciones"
        )
        
        self.tree = ttk.Treeview(tree_frame, columns=columns, show="headings", height=20)
        
        # Definir encabezados
        self.tree.heading("fecha", text="Fecha")
        self.tree.heading("codigo", text="Código")
        self.tree.heading("hora", text="Hora")
        self.tree.heading("municipio", text="Municipio")
        self.tree.heading("departamento", text="Departamento")
        self.tree.heading("tipo", text="Tipo de Incidente")
        self.tree.heading("entidad", text="Entidad de Apoyo")
        self.tree.heading("paciente", text="Paciente")
        self.tree.heading("total_afectados", text="Total Afectados")
        self.tree.heading("acciones", text="Acciones")
        
        # Definir ancho de columnas
        self.tree.column("fecha", width=100, anchor="center")
        self.tree.column("codigo", width=120, anchor="center")
        self.tree.column("hora", width=80, anchor="center")
        self.tree.column("municipio", width=150)
        self.tree.column("departamento", width=150)
        self.tree.column("tipo", width=150)
        self.tree.column("entidad", width=150)
        self.tree.column("paciente", width=200)
        self.tree.column("total_afectados", width=100, anchor="center")
        self.tree.column("acciones", width=150, anchor="center")
        
        # Scrollbars
        v_scrollbar = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self.tree.yview)
        h_scrollbar = ttk.Scrollbar(tree_frame, orient=tk.HORIZONTAL, command=self.tree.xview)
        self.tree.configure(yscrollcommand=v_scrollbar.set, xscrollcommand=h_scrollbar.set)
        
        # Empaquetar Treeview y scrollbars
        self.tree.grid(row=0, column=0, sticky="nsew")
        v_scrollbar.grid(row=0, column=1, sticky="ns")
        h_scrollbar.grid(row=1, column=0, sticky="ew")
        
        tree_frame.grid_rowconfigure(0, weight=1)
        tree_frame.grid_columnconfigure(0, weight=1)
        
        # Botones de acción para registros
        button_frame = ttk.Frame(self.records_frame)
        button_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Button(button_frame, text="Actualizar Lista", 
                  command=self.load_records).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Exportar a Excel (CSV)", 
                  command=self.export_to_excel).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Exportar por Mes", 
                  command=self.export_by_month).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Generar PDF del Registro Seleccionado", 
                  command=self.generate_pdf_selected).pack(side=tk.LEFT, padx=5)
    
    def clear_form(self):
        """Limpia todos los campos del formulario"""
        for field_name, entry in self.entries.items():
            if isinstance(entry, ttk.Entry) or isinstance(entry, tk.Entry):
                entry.delete(0, tk.END)
            elif isinstance(entry, ttk.Combobox):
                entry.set('')
            elif isinstance(entry, tk.Text):
                entry.delete("1.0", tk.END)
        
        # Restablecer valores por defecto
        self.entries["fecha"].delete(0, tk.END)
        self.entries["fecha"].insert(0, datetime.now().strftime("%Y-%m-%d"))
        self.entries["hora"].delete(0, tk.END)
        self.entries["hora"].insert(0, datetime.now().strftime("%H:%M"))
        self.entries["departamento"].set('')
        self.entries["sexo"].set('')
        self.entries["tipo_incidente"].set('')
    
    def save_emergency(self):
        """Guarda una nueva emergencia en la base de datos"""
        # Recopilar datos del formulario
        data = {}
        for field_name, entry in self.entries.items():
            if isinstance(entry, ttk.Entry) or isinstance(entry, tk.Entry):
                data[field_name] = entry.get().strip()
            elif isinstance(entry, ttk.Combobox):
                data[field_name] = entry.get().strip()
            elif isinstance(entry, tk.Text):
                data[field_name] = entry.get("1.0", tk.END).strip()
        
        # Validar campos obligatorios
        required_fields = ["fecha", "hora", "municipio", "tipo_incidente", "departamento"]
        for field in required_fields:
            if not data[field]:
                messagebox.showerror("Error de Validación", 
                                   f"El campo '{field}' es obligatorio.")
                return
        
        # Agregar timestamp
        data["timestamp"] = datetime.now().isoformat()
        
        # Guardar en base de datos
        try:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO emergencias (
                    fecha, hora, municipio, tipo_incidente, entidad_apoyo,
                    nombre_atendio, rango_atendio, nombre_paciente, identificacion_paciente,
                    edad, sexo, barrio_vereda, direccion, telefono, total_afectados,
                    perdidas, unidades, vehiculos, departamento, codigo_emergencia,
                    observaciones, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                data["fecha"], data["hora"], data["municipio"], data["tipo_incidente"],
                data["entidad_apoyo"], data["nombre_atendio"], data["rango_atendio"],
                data["nombre_paciente"], data["identificacion_paciente"], data["edad"],
                data["sexo"], data["barrio_vereda"], data["direccion"], data["telefono"],
                data["total_afectados"], data["perdidas"], data["unidades"], data["vehiculos"],
                data["departamento"], data["codigo_emergencia"], data["observaciones"],
                data["timestamp"]
            ))
            
            conn.commit()
            conn.close()
            
            messagebox.showinfo("Éxito", "Emergencia guardada exitosamente.")
            self.clear_form()
            self.load_records()
            self.notebook.select(1)  # Cambiar a pestaña de registros
            
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo guardar la emergencia:\n{str(e)}")
    
    def load_records(self):
        """Carga todos los registros de la base de datos y los muestra en el Treeview"""
        # Limpiar Treeview
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        # Obtener registros de la base de datos
        try:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, fecha, hora, municipio, departamento, tipo_incidente,
                       entidad_apoyo, nombre_paciente, identificacion_paciente,
                       total_afectados, codigo_emergencia
                FROM emergencias
                ORDER BY timestamp DESC
            ''')
            records = cursor.fetchall()
            conn.close()
            
            # Insertar registros en el Treeview
            for record in records:
                record_id = record[0]
                fecha = record[1]
                hora = record[2]
                municipio = record[3]
                departamento = record[4]
                tipo = record[5]
                entidad = record[6]
                nombre_paciente = record[7]
                identificacion = record[8]
                total_afectados = record[9]
                codigo = record[10]
                
                # Formatear paciente para mostrar
                paciente_display = f"{nombre_paciente} ({identificacion})" if nombre_paciente and identificacion else nombre_paciente or identificacion or "N/A"
                
                self.tree.insert("", tk.END, values=(
                    fecha, codigo, hora, municipio, departamento,
                    tipo, entidad, paciente_display, total_afectados, "Ver/Editar/Eliminar"
                ), tags=(record_id,))
                
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo cargar los registros:\n{str(e)}")
    
    def export_to_excel(self):
        """Exporta todos los registros a un archivo CSV"""
        try:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM emergencias ORDER BY timestamp DESC')
            records = cursor.fetchall()
            conn.close()
            
            if not records:
                messagebox.showinfo("Información", "No hay registros para exportar.")
                return
            
            # Definir encabezados
            headers = [
                "ID", "Fecha", "Hora", "Municipio", "Tipo de Incidente",
                "Entidad de Apoyo", "Nombre del que Atiende", "Rango",
                "Nombre del Paciente", "Identificación del Paciente", "Edad",
                "Sexo", "Barrio/Vereda", "Dirección", "Teléfono",
                "Total de Afectados", "Pérdidas", "Unidades", "Vehículos",
                "Departamento", "Código de Emergencia", "Observaciones",
                "Fecha de Registro"
            ]
            
            # Seleccionar ubicación para guardar
            file_path = filedialog.asksaveasfilename(
                defaultextension=".csv",
                filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
                title="Guardar archivo CSV",
                initialfile=f"BOMBEROS_EMERGENCIAS_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            )
            
            if not file_path:
                return  # Usuario canceló
            
            # Escribir archivo CSV
            with open(file_path, 'w', newline='', encoding='utf-8-sig') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(headers)
                for record in records:
                    writer.writerow(record)
            
            messagebox.showinfo("Éxito", 
                              f"Se exportaron {len(records)} registros exitosamente a:\n{file_path}")
            
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo exportar a Excel:\n{str(e)}")
    
    def export_by_month(self):
        """Exporta registros filtrados por mes y año"""
        # Solicitar año y mes
        year = tk.simpledialog.askinteger("Exportar por Mes", 
                                         "Ingrese el año (ej: 2026):",
                                         minvalue=2000, maxvalue=2100)
        if year is None:
            return
        
        month = tk.simpledialog.askinteger("Exportar por Mes", 
                                          "Ingrese el mes (1-12):",
                                          minvalue=1, maxvalue=12)
        if month is None:
            return
        
        try:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM emergencias 
                WHERE strftime('%Y', fecha) = ? AND strftime('%m', fecha) = ?
                ORDER BY timestamp DESC
            ''', (str(year), f"{month:02d}"))
            records = cursor.fetchall()
            conn.close()
            
            if not records:
                messagebox.showinfo("Información", 
                                  f"No hay registros para {month}/{year}.")
                return
            
            # Definir encabezados
            headers = [
                "ID", "Fecha", "Hora", "Municipio", "Tipo de Incidente",
                "Entidad de Apoyo", "Nombre del que Atiende", "Rango",
                "Nombre del Paciente", "Identificación del Paciente", "Edad",
                "Sexo", "Barrio/Vereda", "Dirección", "Teléfono",
                "Total de Afectados", "Pérdidas", "Unidades", "Vehículos",
                "Departamento", "Código de Emergencia", "Observaciones",
                "Fecha de Registro"
            ]
            
            # Seleccionar ubicación para guardar
            month_name = datetime(year, month, 1).strftime("%B_%Y")
            file_path = filedialog.asksaveasfilename(
                defaultextension=".csv",
                filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
                title=f"Guardar archivo CSV para {month_name}",
                initialfile=f"BOMBEROS_EMERGENCIAS_{month_name}.csv"
            )
            
            if not file_path:
                return  # Usuario canceló
            
            # Escribir archivo CSV
            with open(file_path, 'w', newline='', encoding='utf-8-sig') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(headers)
                for record in records:
                    writer.writerow(record)
            
            messagebox.showinfo("Éxito", 
                              f"Se exportaron {len(records)} registros para {month_name} exitosamente a:\n{file_path}")
            
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo exportar por mes:\n{str(e)}")
    
    def generate_pdf_selected(self):
        """Genera un PDF del registro seleccionado"""
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("Advertencia", "Por favor seleccione un registro primero.")
            return
        
        # Obtener ID del registro seleccionado
        item = self.tree.item(selected[0])
        record_id = item["tags"][0] if item["tags"] else None
        
        if not record_id:
            messagebox.showwarning("Advertencia", "No se pudo obtener el ID del registro.")
            return
        
        # Obtener datos completos del registro
        try:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM emergencias WHERE id = ?', (record_id,))
            record = cursor.fetchone()
            conn.close()
            
            if not record:
                messagebox.showerror("Error", "Registro no encontrado.")
                return
            
            # Mapear campos
            fields = [
                "ID", "Fecha", "Hora", "Municipio", "Tipo de Incidente",
                "Entidad de Apoyo", "Nombre del que Atiende", "Rango",
                "Nombre del Paciente", "Identificación del Paciente", "Edad",
                "Sexo", "Barrio/Vereda", "Dirección", "Teléfono",
                "Total de Afectados", "Pérdidas", "Unidades", "Vehículos",
                "Departamento", "Código de Emergencia", "Observaciones",
                "Timestamp"
            ]
            
            data = dict(zip(fields, record))
            
            # Seleccionar ubicación para guardar PDF
            file_path = filedialog.asksaveasfilename(
                defaultextension=".pdf",
                filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")],
                title="Guardar PDF de Emergencia",
                initialfile=f"BOMBEROS_{data['Codigo de Emergencia'] or 'EMERGENCIA'}_{data['Fecha']}.pdf"
            )
            
            if not file_path:
                return  # Usuario canceló
            
            # Generar PDF (usando reportlab si está disponible, sino mensaje informativo)
            try:
                from reportlab.lib import colors
                from reportlab.lib.pagesizes import letter, A4
                from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
                from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
                from reportlab.lib.units import inch
                
                doc = SimpleDocTemplate(file_path, pagesize=A4)
                styles = getSampleStyleSheet()
                story = []
                
                # Título
                title_style = ParagraphStyle(
                    'CustomTitle',
                    parent=styles['Heading1'],
                    fontSize=18,
                    spaceAfter=30,
                    alignment=1  # Centrado
                )
                story.append(Paragraph("REPORTE DE EMERGENCIA", title_style))
                story.append(Paragraph("BOMBEROS DE COLOMBIA", styles['Heading2']))
                story.append(Spacer(1, 20))
                
                # Información de la emergencia
                data_rows = []
                for label, value in [
                    ("Fecha de Emergencia", data["Fecha"]),
                    ("Hora de Emergencia", data["Hora"]),
                    ("Municipio", data["Municipio"]),
                    ("Departamento", data["Departamento"]),
                    ("Tipo de Incidente", data["Tipo de Incidente"]),
                    ("Entidad de Apoyo", data["Entidad de Apoyo"]),
                    ("Nombre del que Atiende", data["Nombre del que Atiende"]),
                    ("Rango", data["Rango"]),
                    ("Nombre del Paciente", data["Nombre del Paciente"]),
                    ("Identificación del Paciente", data["Identificación del Paciente"]),
                    ("Edad", data["Edad"]),
                    ("Sexo", data["Sexo"]),
                    ("Barrio/Vereda", data["Barrio/Vereda"]),
                    ("Dirección", data["Dirección"]),
                    ("Teléfono", data["Teléfono"]),
                    ("Total de Afectados", data["Total de Afectados"]),
                    ("Pérdidas", data["Pérdidas"]),
                    ("Unidades", data["Unidades"]),
                    ("Vehículos", data["Vehículos"]),
                    ("Observaciones", data["Observaciones"]),
                    ("Fecha de Registro", data["Fecha de Registro"][:19] if data["Fecha de Registro"] else "N/A")
                ]:
                    data_rows.append([Paragraph(f"<b>{label}:</b>", styles["Normal"]), 
                                    Paragraph(str(value) if value else "N/A", styles["Normal"])])
                
                table = Table(data_rows, colWidths=[2*inch, 4*inch])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                
                story.append(table)
                doc.build(story)
                
                messagebox.showinfo("Éxito", 
                                  f"PDF generado exitosamente:\n{file_path}")
                
            except ImportError:
                # Si reportlab no está disponible, mostrar mensaje informativo
                messagebox.showinfo("Información", 
                                  f"Para generar PDFs se necesita la librería 'reportlab'.\n"
                                  f"Instálela con: pip install reportlab\n\n"
                                  f"Los datos del registro seleccionado son:\n\n"
                                  + "\n".join([f"{k}: {v}" for k, v in data.items() if v]))
            
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo generar el PDF:\n{str(e)}")
    
    def backup_database(self):
        """Crea una copia de respaldo de la base de datos"""
        try:
            # Verificar que existe la base de datos
            if not os.path.exists(self.db_name):
                messagebox.showwarning("Advertencia", "No existe base de datos para respaldar.")
                return
            
            # Seleccionar ubicación para guardar el respaldo
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            default_name = f"BOMBEROS_RESPALDO_{timestamp}.db"
            
            file_path = filedialog.asksaveasfilename(
                defaultextension=".db",
                filetypes=[("Database files", "*.db"), ("All files", "*.*")],
                title="Guardar archivo de respaldo",
                initialfile=default_name
            )
            
            if not file_path:
                return  # Usuario canceló
            
            # Copiar archivo de base de datos
            shutil.copy2(self.db_name, file_path)
            
            file_size = os.path.getsize(file_path)
            size_str = f"{file_size / 1024:.1f} KB" if file_size < 1024*1024 else f"{file_size / (1024*1024):.1f} MB"
            
            messagebox.showinfo("Éxito", 
                              f"Respaldo creado exitosamente:\n{file_path}\n\n"
                              f"Tamaño: {size_str}")
            
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo crear el respaldo:\n{str(e)}")
    
    def restore_database(self):
        """Restaura la base de datos desde un archivo de respaldo"""
        if not messagebox.askyesno("Confirmar Restauración", 
                                 "¿Está seguro de que desea restaurar la base de datos?\n"
                                 "Esto reemplazará TODOS los datos actuales con los del archivo de respaldo.\n"
                                 "Esta acción no se puede deshacer."):
            return
        
        try:
            # Seleccionar archivo de respaldo
            file_path = filedialog.askopenfilename(
                defaultextension=".db",
                filetypes=[("Database files", "*.db"), ("All files", "*.*")],
                title="Seleccionar archivo de respaldo para restaurar"
            )
            
            if not file_path:
                return  # Usuario canceló
            
            # Verificar que el archivo existe
            if not os.path.exists(file_path):
                messagebox.showerror("Error", "El archivo seleccionado no existe.")
                return
            
            # Cerrar conexiones abiertas (en una app real sería más complejo)
            # Para simplicidad, asumimos que no hay conexiones abiertas además de las nuestras
            
            # Copiar archivo de respaldo sobre la base de datos actual
            shutil.copy2(file_path, self.db_name)
            
            # Recargar la interfaz
            self.load_records()
            
            messagebox.showinfo("Éxito", 
                              f"Base de datos restaurada exitosamente desde:\n{file_path}")
            
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo restaurar la base de datos:\n{str(e)}")
    
    def show_about(self):
        """Muestra información acerca de la aplicación"""
        about_text = """Sistema de Gestión de Emergencias
        Para Bomberos de Colombia

        Versión 1.0
        Desarrollado con Python y Tkinter

        Características:
        - Base de datos SQLite integrada
        - Formulario completo para ingreso de emergencias
        - Funcionalidad de respaldo y restauración
        - Exportación a CSV (Excel)
        - Generación de PDF individual
        - Interfaz moderna y profesional

        © 2026 Sistema de Bomberos Colombia"""
        
        messagebox.showinfo("Acerca de", about_text)

def main():
    root = tk.Tk()
    app = BomberosApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
