package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"task-reminder/backend/internal/auth"
	"task-reminder/backend/internal/database"
	"task-reminder/backend/internal/http"
	"task-reminder/backend/internal/outbox"
	"task-reminder/backend/internal/reminders"
	"task-reminder/backend/internal/subscriptions"
	"task-reminder/backend/internal/whatsapp"
)

func main() {
	log.Println("=== Starting Task Reminder Backend (Go + Fiber + whatsmeow) ===")

	port := os.Getenv("BACKEND_PORT")
	if port == "" {
		port = os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
	}

	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./data/task-reminder.sqlite"
	}

	waStorePath := os.Getenv("WHATSAPP_STORE_PATH")
	if waStorePath == "" {
		waStorePath = "./data/whatsapp.sqlite"
	}

	uploadsDir := os.Getenv("UPLOADS_DIR")
	if uploadsDir == "" {
		uploadsDir = "./data/uploads"
	}

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "*"
	}

	// 1. Initialize SQLite Database
	db, err := database.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()
	log.Printf("SQLite database initialized at: %s", dbPath)

	// 2. Initialize WhatsApp Service (whatsmeow)
	waSvc, err := whatsapp.NewService(waStorePath)
	if err != nil {
		log.Printf("[Warning] Failed to initialize whatsmeow store: %v", err)
	} else {
		defer waSvc.Close()
		// Try autoconnect if previous session exists
		go func() {
			time.Sleep(1 * time.Second)
			if err := waSvc.AutoConnect(); err != nil {
				log.Printf("[WhatsApp] Autoconnect info: %v", err)
			} else {
				log.Println("[WhatsApp] Autoconnect attempt finished")
			}
		}()
	}

	// 3. Initialize Outbox and Subscription Services
	outboxSvc := outbox.NewService(db, waSvc)
	subSvc := subscriptions.NewService(db, outboxSvc)

	// 4. Initialize Auth Service
	authSvc := auth.NewService(db, outboxSvc)

	// 5. Initialize Scheduler (Deadline Reminders + Outbox Processor + Subscription Expirations)
	scheduler := reminders.NewScheduler(db, waSvc, outboxSvc, subSvc)
	scheduler.Start()
	defer scheduler.Stop()

	// 6. Setup HTTP Router
	app := http.SetupRouter(http.Config{
		DB:             db,
		AuthSvc:        authSvc,
		WASvc:          waSvc,
		OutboxSvc:      outboxSvc,
		SubSvc:         subSvc,
		Scheduler:      scheduler,
		AllowedOrigins: corsOrigin,
		UploadsDir:     uploadsDir,
	})

	// 7. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		addr := ":" + port
		log.Printf("Task Reminder API server listening on %s", addr)
		if err := app.Listen(addr); err != nil {
			log.Printf("Server listen error: %v", err)
		}
	}()

	<-quit
	log.Println("Shutting down Task Reminder server gracefully...")

	if err := app.ShutdownWithTimeout(5 * time.Second); err != nil {
		log.Printf("Fiber shutdown error: %v", err)
	}

	log.Println("Server stopped cleanly. Goodbye!")
}
