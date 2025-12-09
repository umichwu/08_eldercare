-- ================================================
-- ElderCare - 警示系統資料表
-- ================================================
-- 用途：儲存家屬監控面板的各類警示
-- 建立日期：2025-01-21
-- ================================================

-- 1. 刪除現有表格（如果存在）
DROP TABLE IF EXISTS alerts CASCADE;

-- 2. 建立 alerts 表
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 關聯的長輩
  elder_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- 警示類型
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'medication',    -- 用藥警示
    'health',        -- 健康警示
    'activity',      -- 活動警示
    'emergency'      -- 緊急警示
  )),

  -- 嚴重程度
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN (
    'low',      -- 低：提醒性質
    'medium',   -- 中：需要注意
    'high',     -- 高：需要處理
    'critical'  -- 緊急：立即處理
  )),

  -- 警示內容
  title TEXT NOT NULL,
  description TEXT,

  -- 相關資源
  related_medication_id UUID REFERENCES medication_reminders(id) ON DELETE SET NULL,
  related_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- 狀態
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- 待處理
    'resolved',   -- 已處理
    'dismissed'   -- 已忽略
  )),

  -- 處理資訊
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  resolution_note TEXT,

  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 建立索引以提升查詢效能
CREATE INDEX idx_alerts_elder ON alerts(elder_id);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX idx_alerts_pending ON alerts(elder_id, status) WHERE status = 'pending';

-- 4. 建立自動更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_alerts_updated_at();

-- 5. 啟用 Row Level Security (RLS)
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- 6. 建立 RLS 政策

-- 政策 1: 家屬可以查看所照顧長輩的警示
CREATE POLICY "Family members can view alerts for their elders"
  ON alerts
  FOR SELECT
  USING (
    elder_id IN (
      SELECT elder_id
      FROM elder_family_relationships
      WHERE family_member_id IN (
        SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
      )
    )
  );

-- 政策 2: 系統可以建立警示
CREATE POLICY "System can create alerts"
  ON alerts
  FOR INSERT
  WITH CHECK (true);

-- 政策 3: 家屬可以更新所照顧長輩的警示
CREATE POLICY "Family members can update alerts for their elders"
  ON alerts
  FOR UPDATE
  USING (
    elder_id IN (
      SELECT elder_id
      FROM elder_family_relationships
      WHERE family_member_id IN (
        SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
      )
    )
  );

-- 政策 4: 家屬可以刪除所照顧長輩的警示
CREATE POLICY "Family members can delete alerts for their elders"
  ON alerts
  FOR DELETE
  USING (
    elder_id IN (
      SELECT elder_id
      FROM elder_family_relationships
      WHERE family_member_id IN (
        SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
      )
    )
  );

-- 7. 建立輔助函數

-- 取得待處理警示數量
CREATE OR REPLACE FUNCTION get_pending_alerts_count(p_elder_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM alerts
    WHERE elder_id = p_elder_id
      AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 建立用藥警示
CREATE OR REPLACE FUNCTION create_medication_alert(
  p_elder_id UUID,
  p_medication_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_severity TEXT DEFAULT 'medium'
)
RETURNS UUID AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO alerts (
    elder_id,
    alert_type,
    severity,
    title,
    description,
    related_medication_id
  ) VALUES (
    p_elder_id,
    'medication',
    p_severity,
    p_title,
    p_description,
    p_medication_id
  )
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 建立健康警示
CREATE OR REPLACE FUNCTION create_health_alert(
  p_elder_id UUID,
  p_conversation_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_severity TEXT DEFAULT 'medium'
)
RETURNS UUID AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO alerts (
    elder_id,
    alert_type,
    severity,
    title,
    description,
    related_conversation_id
  ) VALUES (
    p_elder_id,
    'health',
    p_severity,
    p_title,
    p_description,
    p_conversation_id
  )
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 建立活動警示
CREATE OR REPLACE FUNCTION create_activity_alert(
  p_elder_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_severity TEXT DEFAULT 'medium'
)
RETURNS UUID AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO alerts (
    elder_id,
    alert_type,
    severity,
    title,
    description
  ) VALUES (
    p_elder_id,
    'activity',
    p_severity,
    p_title,
    p_description
  )
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 建立緊急警示
CREATE OR REPLACE FUNCTION create_emergency_alert(
  p_elder_id UUID,
  p_title TEXT,
  p_description TEXT
)
RETURNS UUID AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO alerts (
    elder_id,
    alert_type,
    severity,
    title,
    description
  ) VALUES (
    p_elder_id,
    'emergency',
    'critical',
    p_title,
    p_description
  )
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 標記警示為已處理
CREATE OR REPLACE FUNCTION resolve_alert(
  p_alert_id UUID,
  p_resolved_by UUID,
  p_resolution_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE alerts
  SET
    status = 'resolved',
    resolved_at = NOW(),
    resolved_by = p_resolved_by,
    resolution_note = p_resolution_note
  WHERE id = p_alert_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 檢查連續錯過服藥（用於自動建立警示）
CREATE OR REPLACE FUNCTION check_missed_medication_alerts()
RETURNS void AS $$
DECLARE
  v_elder RECORD;
  v_missed_count INTEGER;
  v_threshold INTEGER := 2;  -- 連續錯過 2 次
BEGIN
  -- 遍歷所有長輩
  FOR v_elder IN
    SELECT DISTINCT elder_id
    FROM medication_reminders
    WHERE is_active = true
  LOOP
    -- 計算最近連續錯過的次數
    SELECT COUNT(*)
    INTO v_missed_count
    FROM (
      SELECT ml.*
      FROM medication_logs ml
      WHERE ml.elder_id = v_elder.elder_id
        AND ml.status = 'missed'
        AND ml.scheduled_time >= NOW() - INTERVAL '2 days'
      ORDER BY ml.scheduled_time DESC
      LIMIT v_threshold
    ) recent_logs
    WHERE status = 'missed';

    -- 如果連續錯過達到閾值，且尚未有相同的待處理警示
    IF v_missed_count >= v_threshold THEN
      IF NOT EXISTS (
        SELECT 1
        FROM alerts
        WHERE elder_id = v_elder.elder_id
          AND alert_type = 'medication'
          AND status = 'pending'
          AND created_at >= NOW() - INTERVAL '1 day'
      ) THEN
        -- 建立警示
        PERFORM create_medication_alert(
          v_elder.elder_id,
          NULL,
          '連續錯過服藥',
          format('已連續錯過 %s 次服藥，請關注長輩用藥狀況', v_missed_count),
          'high'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 檢查活動異常（用於自動建立警示）
CREATE OR REPLACE FUNCTION check_inactivity_alerts()
RETURNS void AS $$
DECLARE
  v_elder RECORD;
  v_last_activity TIMESTAMPTZ;
  v_threshold INTERVAL := INTERVAL '24 hours';
BEGIN
  -- 遍歷所有長輩
  FOR v_elder IN
    SELECT id, display_name
    FROM user_profiles
    WHERE role = 'elder'
  LOOP
    -- 取得最後活動時間（對話或用藥記錄）
    SELECT MAX(last_activity)
    INTO v_last_activity
    FROM (
      SELECT MAX(c.created_at) AS last_activity
      FROM conversations c
      WHERE c.user_id = v_elder.id
      UNION ALL
      SELECT MAX(ml.actual_time) AS last_activity
      FROM medication_logs ml
      WHERE ml.elder_id = v_elder.id
    ) activities;

    -- 如果超過 24 小時無活動，且尚未有相同的待處理警示
    IF v_last_activity IS NOT NULL AND v_last_activity < NOW() - v_threshold THEN
      IF NOT EXISTS (
        SELECT 1
        FROM alerts
        WHERE elder_id = v_elder.id
          AND alert_type = 'activity'
          AND status = 'pending'
          AND created_at >= NOW() - INTERVAL '1 day'
      ) THEN
        -- 建立警示
        PERFORM create_activity_alert(
          v_elder.id,
          '長時間無活動',
          format('%s 已超過 24 小時未有任何活動記錄，請確認長輩狀況', v_elder.display_name),
          'medium'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 註解說明
COMMENT ON TABLE alerts IS '警示系統表 - 儲存家屬監控面板的各類警示';
COMMENT ON COLUMN alerts.alert_type IS '警示類型：medication（用藥）、health（健康）、activity（活動）、emergency（緊急）';
COMMENT ON COLUMN alerts.severity IS '嚴重程度：low、medium、high、critical';
COMMENT ON COLUMN alerts.status IS '狀態：pending（待處理）、resolved（已處理）、dismissed（已忽略）';

-- 完成
SELECT '✅ alerts 警示系統資料表建立完成！' AS status;
